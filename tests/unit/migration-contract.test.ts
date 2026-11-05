import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("foundation migration contract", () => {
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

    expect(sql.indexOf("membership.condition_event")).toBeLessThan(
      sql.indexOf("[authorization].access_assignment")
    );
  });
});
