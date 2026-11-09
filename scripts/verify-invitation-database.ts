import "dotenv/config";

import { randomUUID } from "node:crypto";

import type { ActionTokenDelivery } from "../src/modules/auth/application/ports/auth-crypto.js";
import { InvitationService } from "../src/modules/auth/application/invitation-service.js";
import { ArgonPasswordHasher } from "../src/modules/auth/infrastructure/argon-password-hasher.js";
import { JoseAuthTokenCodec } from "../src/modules/auth/infrastructure/jose-auth-token-codec.js";
import { MssqlAuthStore } from "../src/modules/auth/infrastructure/mssql-auth-store.js";
import { MssqlInvitationStore } from "../src/modules/auth/infrastructure/mssql-invitation-store.js";
import { loadConfig } from "../src/shared/infrastructure/config/env.js";
import { createConnectionPool } from "../src/shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "../src/shared/infrastructure/database/database-config.js";

class CapturingDelivery implements ActionTokenDelivery {
  public token: string | undefined;
  public deliveries = 0;
  public deliver(input: Parameters<ActionTokenDelivery["deliver"]>[0]): Promise<void> {
    if (input.purpose === "CLUB_INVITATION") {
      this.token = input.token;
      this.deliveries += 1;
    }
    return Promise.resolve();
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createConnectionPool(loadDatabaseConfig());
  await pool.connect();
  const tenantId = randomUUID();
  const institutionId = randomUUID();
  const clubId = randomUUID();
  const adminAccountId = randomUUID();
  const roleId = randomUUID();
  const suffix = randomUUID();
  const delivery = new CapturingDelivery();
  const passwords = new ArgonPasswordHasher();
  const codec = new JoseAuthTokenCodec(config.auth.jwtAccessSecret, config.auth.tokenPepper, config.auth.jwtIssuer, config.auth.jwtAudience);
  const service = new InvitationService(new MssqlInvitationStore(pool), new MssqlAuthStore(pool), passwords, codec, delivery, config.auth);
  let acceptedAccountId: string | undefined;

  try {
    await pool.request().input("tenantId", tenantId).input("institutionId", institutionId).input("clubId", clubId).input("adminId", adminAccountId).input("roleId", roleId).input("tenantCode", `VERIFY-${suffix}`).input("adminEmail", `verify-admin-${suffix}@example.invalid`).query(`
      INSERT INTO [C_platform].tenant (tenant_id,code,display_name,service_status,activated_at_utc) VALUES (@tenantId,@tenantCode,N'Invitation verification','ACTIVE',SYSUTCDATETIME());
      INSERT INTO [C_organization].institution (institution_id,tenant_id,code,legal_name,display_name,time_zone_id,status) VALUES (@institutionId,@tenantId,'VERIFY',N'Invitation verification',N'Universidad de prueba','America/Mexico_City','ACTIVE');
      INSERT INTO [C_organization].club (club_id,tenant_id,institution_id,code,name,status) VALUES (@clubId,@tenantId,@institutionId,'VERIFY',N'Club de prueba','ACTIVE');
      INSERT INTO [C_identity].account (account_id,email_normalized,status,email_verified_at_utc) VALUES (@adminId,@adminEmail,'ACTIVE',SYSUTCDATETIME());
      INSERT INTO [C_authorization].role (role_id,code,name,scope_type,is_system,status) VALUES (@roleId,@tenantCode,N'Invitation verifier','CLUB',0,'ACTIVE');
      INSERT INTO [C_authorization].role_permission (role_id,permission_id) SELECT @roleId,permission_id FROM [C_authorization].permission WHERE code='membership.invitation.create';
      INSERT INTO [C_authorization].access_assignment (account_id,role_id,scope_type,tenant_id,club_id,status,granted_at_utc) VALUES (@adminId,@roleId,'CLUB',@tenantId,@clubId,'ACTIVE',SYSUTCDATETIME());
    `);

    const targetEmail = `verify-aspirant-${suffix}@example.invalid`;
    const created = await service.create({ actorAccountId: adminAccountId, clubId, email: targetEmail, idempotencyKey: `create-${suffix}`, correlationId: randomUUID() });
    const replayedCreate = await service.create({ actorAccountId: adminAccountId, clubId, email: targetEmail, idempotencyKey: `create-${suffix}`, correlationId: randomUUID() });
    if (created.replayed || !replayedCreate.replayed || delivery.deliveries !== 1 || delivery.token === undefined) throw new Error("Invitation creation idempotency failed");
    const inspected = await service.inspect(delivery.token);
    if (inspected.clubName !== "Club de prueba") throw new Error("Invitation context is incorrect");

    const acceptanceInput = { token: delivery.token, password: "Verification-password-123!", givenNames: "Persona", familyName: "Invitada", idempotencyKey: `accept-${suffix}`, correlationId: randomUUID() };
    const accepted = await service.accept(acceptanceInput);
    acceptedAccountId = accepted.accountId;
    const replayedAcceptance = await service.accept(acceptanceInput);
    if (!replayedAcceptance.replayed) throw new Error("Invitation acceptance idempotency failed");

    const result = await pool.request().input("membershipId", accepted.membershipId).input("accountId", accepted.accountId).query<{ membershipStatus: string; memberCondition: string; accessCount: number }>(`
      SELECT cm.membership_status AS membershipStatus,cm.member_condition AS memberCondition,(SELECT COUNT(*) FROM [C_authorization].access_assignment WHERE account_id=@accountId) AS accessCount
      FROM [C_membership].club_membership cm WHERE cm.membership_id=@membershipId;
    `);
    const row = result.recordset[0];
    if (row?.membershipStatus !== "PENDING" || row.memberCondition !== "ASPIRANT" || row.accessCount !== 0) throw new Error("Accepted account received an invalid status, condition or access assignment");
    process.stdout.write(`${JSON.stringify({ invitationCreated: true, createReplay: replayedCreate.replayed, deliveredOnce: true, acceptedAsAspirant: true, acceptReplay: replayedAcceptance.replayed, elevatedAccessCount: row.accessCount })}\n`);
  } finally {
    try {
      await pool.request().input("tenantId", tenantId).input("adminId", adminAccountId).input("acceptedId", acceptedAccountId ?? randomUUID()).input("roleId", roleId).query(`
        DELETE FROM [C_audit].audit_event WHERE tenant_id=@tenantId;
        DELETE FROM [C_audit].idempotency_record WHERE tenant_id=@tenantId;
        DELETE FROM [C_membership].club_invitation WHERE tenant_id=@tenantId;
        DELETE FROM [C_identity].action_token WHERE tenant_id=@tenantId OR created_by_account_id=@adminId;
        DELETE FROM [C_membership].condition_event WHERE tenant_id=@tenantId;
        DELETE FROM [C_membership].club_membership WHERE tenant_id=@tenantId;
        DELETE FROM [C_identity].account_person_link WHERE tenant_id=@tenantId;
        DELETE FROM [C_identity].person WHERE tenant_id=@tenantId;
        DELETE FROM [C_authorization].access_assignment WHERE tenant_id=@tenantId OR account_id IN (@adminId,@acceptedId);
        DELETE FROM [C_authorization].role_permission WHERE role_id=@roleId;
        DELETE FROM [C_authorization].role WHERE role_id=@roleId;
        DELETE FROM [C_identity].account WHERE account_id IN (@adminId,@acceptedId);
        DELETE FROM [C_organization].club WHERE tenant_id=@tenantId;
        DELETE FROM [C_organization].institution WHERE tenant_id=@tenantId;
        DELETE FROM [C_platform].tenant WHERE tenant_id=@tenantId;
      `);
    } finally { await pool.close(); }
  }
}

await main();
