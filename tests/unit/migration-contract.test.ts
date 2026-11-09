import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("foundation migration contract", () => {
  it("keeps every physical schema under the Colportando C_ namespace", async () => {
    const infrastructure = await readFile(path.join(projectRoot, "migrations/0001_infrastructure.up.sql"), "utf8");
    const foundation = await readFile(path.join(projectRoot, "migrations/0002_foundation.up.sql"), "utf8");
    const sessions = await readFile(path.join(projectRoot, "migrations/0003_auth_sessions.up.sql"), "utf8");
    const training = await readFile(path.join(projectRoot, "migrations/0005_training_core.up.sql"), "utf8");

    for (const schema of ["infra", "platform", "organization", "identity", "membership", "authorization", "audit"]) {
      expect(infrastructure).toContain(`N'C_${schema}'`);
    }
    expect(`${foundation}\n${sessions}`).not.toMatch(/\[(identity|authorization)\]|\b(platform|organization|membership|audit)\./);
    expect(training).toContain("[C_training]");
    expect(training).not.toMatch(/\[training\]/);
  });

  it("keeps training factual and separate from promotion", async () => {
    const sql = await readFile(path.join(projectRoot, "migrations/0005_training_core.up.sql"), "utf8");
    const store = await readFile(path.join(projectRoot, "src/modules/training/infrastructure/mssql-training-store.ts"), "utf8");
    expect(sql).toContain("training.attendance.record");
    expect(store).toContain("member_condition='ASPIRANT'");
    expect(sql).not.toMatch(/UPDATE\s+\[C_membership\]\.club_membership/i);
    expect(sql).not.toContain("TRAINING_COMPLETION");
  });

  it("encodes tenant-safe membership and audited promotion constraints", async () => {
    const sql = await readFile(path.join(projectRoot, "migrations/0002_foundation.up.sql"), "utf8");

    expect(sql).toContain("DEFAULT 'ASPIRANT'");
    expect(sql).toContain("FOREIGN KEY (tenant_id, club_id)");
    expect(sql).toContain("FOREIGN KEY (tenant_id, person_id)");
    expect(sql).toContain("previous_condition = 'ASPIRANT' AND new_condition = 'COLPORTOR'");
    expect(sql).toContain("evidence_json IS NOT NULL");
    expect(sql).toContain("FK_condition_event_actor_assignment");
    expect(sql).toContain("NOT (consumed_at_utc IS NOT NULL AND revoked_at_utc IS NOT NULL)");
  });

  it("drops condition events before their access assignments", async () => {
    const sql = await readFile(path.join(projectRoot, "migrations/0002_foundation.down.sql"), "utf8");

    expect(sql.indexOf("[C_membership].condition_event")).toBeLessThan(
      sql.indexOf("[C_authorization].access_assignment")
    );
  });

  it("keeps public invitation persistence participant-only", async () => {
    const sql = await readFile(path.join(projectRoot, "migrations/0004_club_invitations.up.sql"), "utf8");
    expect(sql).toContain("membership.invitation.create");
    expect(sql).toContain("[C_membership].club_invitation");
    expect(sql).not.toMatch(/role_id|member_condition|position_id/);
  });
});
