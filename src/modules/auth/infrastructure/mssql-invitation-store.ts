import { randomUUID } from "node:crypto";

import sql from "mssql";

import type { CreateInvitationResult, InvitationContext, InvitationResult, InvitationStore } from "../application/ports/invitation-store.js";

type ClubRow = Readonly<{ tenantId: string; clubId: string; clubName: string; institutionName: string }>;
type IdempotencyRow = Readonly<{ requestHash: Buffer; responseJson: string }>;
type InvitationRow = InvitationContext & Readonly<{ actionTokenId: string; storedTokenHash: Buffer; failedAttempts: number; maxAttempts: number; tokenConsumedAt: Date | null; tokenRevokedAt: Date | null; invitationStatus: string; tenantStatus: string; clubStatus: string }>;

const parseCreateResponse = (value: string): CreateInvitationResult => ({ ...(JSON.parse(value) as Omit<CreateInvitationResult, "expiresAt">), expiresAt: new Date((JSON.parse(value) as { expiresAt: string }).expiresAt), replayed: true });
const parseAcceptResponse = (value: string): InvitationResult => ({ ...(JSON.parse(value) as Omit<InvitationResult, "replayed">), replayed: true });

export class MssqlInvitationStore implements InvitationStore {
  public constructor(private readonly pool: sql.ConnectionPool) {}

  public async createInvitation(input: Parameters<InvitationStore["createInvitation"]>[0]): Promise<CreateInvitationResult | "FORBIDDEN" | "IDEMPOTENCY_CONFLICT"> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const clubResult = await new sql.Request(transaction).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("clubId", sql.UniqueIdentifier, input.clubId).query<ClubRow>(`
        SELECT TOP (1) c.tenant_id AS tenantId, c.club_id AS clubId, c.name AS clubName, i.display_name AS institutionName
        FROM [C_organization].club c
        JOIN [C_organization].institution i ON i.tenant_id=c.tenant_id AND i.institution_id=c.institution_id
        JOIN [C_platform].tenant t ON t.tenant_id=c.tenant_id
        JOIN [C_authorization].access_assignment aa ON aa.account_id=@actor AND aa.status='ACTIVE' AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME())
        JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id
        JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id AND p.code='membership.invitation.create' AND p.status='ACTIVE'
        WHERE c.club_id=@clubId AND c.status='ACTIVE' AND i.status='ACTIVE' AND t.service_status='ACTIVE'
          AND (aa.scope_type='PLATFORM' OR (aa.scope_type='INSTITUTION' AND aa.tenant_id=c.tenant_id AND aa.institution_id=c.institution_id) OR (aa.scope_type='CLUB' AND aa.tenant_id=c.tenant_id AND aa.club_id=c.club_id));
      `);
      const club = clubResult.recordset[0];
      if (club === undefined) { await transaction.commit(); return "FORBIDDEN"; }

      const replay = await this.readIdempotency(transaction, club.tenantId, input.subjectHash, "CREATE_CLUB_INVITATION", input.idempotencyKey);
      if (replay !== null) {
        await transaction.commit();
        return replay.requestHash.equals(input.requestHash) ? parseCreateResponse(replay.responseJson) : "IDEMPOTENCY_CONFLICT";
      }

      const request = new sql.Request(transaction);
      request.input("invitationId", sql.UniqueIdentifier, input.invitationId).input("actionTokenId", sql.UniqueIdentifier, input.actionTokenId).input("tenantId", sql.UniqueIdentifier, club.tenantId).input("clubId", sql.UniqueIdentifier, club.clubId).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("email", sql.VarChar(320), input.targetEmail).input("tokenHash", sql.VarBinary(32), input.tokenHash).input("now", sql.DateTime2(3), input.now).input("expires", sql.DateTime2(3), input.expiresAt).input("maxAttempts", sql.Int, input.maxAttempts);
      await request.query(`
        UPDATE at SET revoked_at_utc=@now
        FROM [C_identity].action_token at JOIN [C_membership].club_invitation ci ON ci.action_token_id=at.action_token_id
        WHERE ci.tenant_id=@tenantId AND ci.club_id=@clubId AND ci.target_email_normalized=@email AND ci.status='PENDING' AND at.consumed_at_utc IS NULL AND at.revoked_at_utc IS NULL;
        UPDATE [C_membership].club_invitation SET status='REVOKED', revoked_at_utc=@now
        WHERE tenant_id=@tenantId AND club_id=@clubId AND target_email_normalized=@email AND status='PENDING';
        INSERT INTO [C_identity].action_token (action_token_id,purpose,token_hash,tenant_id,club_id,target_email_normalized,issued_at_utc,expires_at_utc,created_by_account_id,max_attempts)
        VALUES (@actionTokenId,'CLUB_INVITATION',@tokenHash,@tenantId,@clubId,@email,@now,@expires,@actor,@maxAttempts);
        INSERT INTO [C_membership].club_invitation (invitation_id,tenant_id,club_id,action_token_id,target_email_normalized,invited_by_account_id,created_at_utc,expires_at_utc)
        VALUES (@invitationId,@tenantId,@clubId,@actionTokenId,@email,@actor,@now,@expires);
      `);
      const response: CreateInvitationResult = { invitationId: input.invitationId, tenantId: club.tenantId, clubId: club.clubId, clubName: club.clubName, institutionName: club.institutionName, targetEmail: input.targetEmail, expiresAt: input.expiresAt, replayed: false };
      await this.writeIdempotency(transaction, club.tenantId, input.actorAccountId, input.subjectHash, "CREATE_CLUB_INVITATION", input.idempotencyKey, input.requestHash, JSON.stringify({ ...response, expiresAt: response.expiresAt.toISOString() }), "CLUB_INVITATION", input.invitationId, input.now);
      await new sql.Request(transaction).input("tenantId", sql.UniqueIdentifier, club.tenantId).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("entityId", sql.NVarChar(100), input.invitationId).input("correlationId", sql.UniqueIdentifier, input.correlationId).input("after", sql.NVarChar(sql.MAX), JSON.stringify({ clubId: club.clubId, status: "PENDING" })).input("now", sql.DateTime2(3), input.now).query(`INSERT INTO [C_audit].audit_event (tenant_id,actor_account_id,action,entity_type,entity_id,correlation_id,after_json,occurred_at_utc) VALUES (@tenantId,@actor,'CLUB_INVITATION_CREATED','CLUB_INVITATION',@entityId,@correlationId,@after,@now);`);
      await transaction.commit();
      return response;
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async inspectInvitation(email: string, tokenHash: Buffer, now: Date): Promise<InvitationContext | null> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction).input("email", sql.VarChar(320), email).input("now", sql.DateTime2(3), now).query<InvitationRow>(`
      SELECT TOP (1) ci.invitation_id AS invitationId, ci.tenant_id AS tenantId, ci.club_id AS clubId, c.name AS clubName, i.display_name AS institutionName, ci.target_email_normalized AS targetEmail, ci.expires_at_utc AS expiresAt,
        ci.action_token_id AS actionTokenId, at.token_hash AS storedTokenHash, at.failed_attempt_count AS failedAttempts, at.max_attempts AS maxAttempts, at.consumed_at_utc AS tokenConsumedAt, at.revoked_at_utc AS tokenRevokedAt, ci.status AS invitationStatus, t.service_status AS tenantStatus, c.status AS clubStatus
      FROM [C_membership].club_invitation ci
      JOIN [C_identity].action_token at WITH (UPDLOCK,HOLDLOCK) ON at.action_token_id=ci.action_token_id
      JOIN [C_organization].club c ON c.tenant_id=ci.tenant_id AND c.club_id=ci.club_id
      JOIN [C_organization].institution i ON i.tenant_id=c.tenant_id AND i.institution_id=c.institution_id
      JOIN [C_platform].tenant t ON t.tenant_id=ci.tenant_id
      WHERE ci.target_email_normalized=@email AND at.purpose='CLUB_INVITATION' ORDER BY ci.created_at_utc DESC;
    `);
      const row = result.recordset[0];
      if (row === undefined || row.invitationStatus !== "PENDING" || row.expiresAt <= now || row.tokenConsumedAt !== null || row.tokenRevokedAt !== null || row.tenantStatus !== "ACTIVE" || row.clubStatus !== "ACTIVE") { await transaction.commit(); return null; }
      if (!row.storedTokenHash.equals(tokenHash)) {
        const failed = row.failedAttempts + 1;
        await new sql.Request(transaction).input("tokenId", sql.UniqueIdentifier, row.actionTokenId).input("failed", sql.Int, failed).input("now", sql.DateTime2(3), now).query(`UPDATE [C_identity].action_token SET failed_attempt_count=@failed, revoked_at_utc=CASE WHEN @failed>=max_attempts THEN @now ELSE revoked_at_utc END WHERE action_token_id=@tokenId;`);
        await transaction.commit(); return null;
      }
      await transaction.commit();
      return { invitationId: row.invitationId, tenantId: row.tenantId, clubId: row.clubId, clubName: row.clubName, institutionName: row.institutionName, targetEmail: row.targetEmail, expiresAt: row.expiresAt };
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async findAcceptanceReplay(tokenHash: Buffer, idempotencyKey: string, requestHash: Buffer): Promise<InvitationResult | "IDEMPOTENCY_CONFLICT" | null> {
    const result = await this.pool.request().input("subjectHash", sql.VarBinary(32), tokenHash).input("key", sql.VarChar(100), idempotencyKey).query<IdempotencyRow>(`
      SELECT request_hash AS requestHash,response_json AS responseJson
      FROM [C_audit].idempotency_record
      WHERE subject_hash=@subjectHash AND operation='ACCEPT_CLUB_INVITATION' AND idempotency_key=@key AND status='COMPLETED';
    `);
    const row = result.recordset[0];
    if (row === undefined) return null;
    return row.requestHash.equals(requestHash) ? parseAcceptResponse(row.responseJson) : "IDEMPOTENCY_CONFLICT";
  }

  public async acceptInvitation(input: Parameters<InvitationStore["acceptInvitation"]>[0]): Promise<InvitationResult | "INVALID" | "CONFLICT" | "IDEMPOTENCY_CONFLICT"> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const invitationResult = await new sql.Request(transaction).input("hash", sql.VarBinary(32), input.tokenHash).input("email", sql.VarChar(320), input.targetEmail).query<InvitationRow>(`
        SELECT ci.invitation_id AS invitationId, ci.tenant_id AS tenantId, ci.club_id AS clubId, c.name AS clubName, i.display_name AS institutionName, ci.target_email_normalized AS targetEmail, ci.expires_at_utc AS expiresAt,
          ci.action_token_id AS actionTokenId, at.consumed_at_utc AS tokenConsumedAt, at.revoked_at_utc AS tokenRevokedAt, ci.status AS invitationStatus, t.service_status AS tenantStatus, c.status AS clubStatus
        FROM [C_membership].club_invitation ci WITH (UPDLOCK,HOLDLOCK)
        JOIN [C_identity].action_token at WITH (UPDLOCK,HOLDLOCK) ON at.action_token_id=ci.action_token_id
        JOIN [C_organization].club c ON c.tenant_id=ci.tenant_id AND c.club_id=ci.club_id
        JOIN [C_organization].institution i ON i.tenant_id=c.tenant_id AND i.institution_id=c.institution_id
        JOIN [C_platform].tenant t ON t.tenant_id=ci.tenant_id
        WHERE at.token_hash=@hash AND ci.target_email_normalized=@email AND at.purpose='CLUB_INVITATION';
      `);
      const invitation = invitationResult.recordset[0];
      if (invitation === undefined) { await transaction.commit(); return "INVALID"; }
      const replay = await this.readIdempotency(transaction, invitation.tenantId, input.tokenHash, "ACCEPT_CLUB_INVITATION", input.idempotencyKey);
      if (replay !== null) { await transaction.commit(); return replay.requestHash.equals(input.requestHash) ? parseAcceptResponse(replay.responseJson) : "IDEMPOTENCY_CONFLICT"; }
      if (invitation.invitationStatus !== "PENDING" || invitation.tokenConsumedAt !== null || invitation.tokenRevokedAt !== null || invitation.expiresAt <= input.now || invitation.tenantStatus !== "ACTIVE" || invitation.clubStatus !== "ACTIVE") { await transaction.commit(); return "INVALID"; }

      const accountId = input.existingAccountId ?? input.newAccount?.accountId;
      if (accountId === undefined) { await transaction.commit(); return "CONFLICT"; }
      const existingAccount = await new sql.Request(transaction).input("accountId", sql.UniqueIdentifier, accountId).input("email", sql.VarChar(320), invitation.targetEmail).query<{ accountId: string }>(`SELECT account_id AS accountId FROM [C_identity].account WITH (UPDLOCK,HOLDLOCK) WHERE account_id=@accountId AND email_normalized=@email AND status IN ('ACTIVE','PENDING_VERIFICATION');`);
      if (input.existingAccountId !== undefined && existingAccount.recordset[0] === undefined) { await transaction.commit(); return "CONFLICT"; }
      if (input.newAccount !== undefined) {
        const emailExists = await new sql.Request(transaction).input("email", sql.VarChar(320), invitation.targetEmail).query(`SELECT account_id FROM [C_identity].account WITH (UPDLOCK,HOLDLOCK) WHERE email_normalized=@email;`);
        if (emailExists.recordset.length > 0) { await transaction.commit(); return "CONFLICT"; }
        await new sql.Request(transaction).input("accountId", sql.UniqueIdentifier, accountId).input("email", sql.VarChar(320), invitation.targetEmail).input("passwordHash", sql.VarChar(255), input.newAccount.passwordHash).input("now", sql.DateTime2(3), input.now).query(`INSERT INTO [C_identity].account (account_id,email_normalized,password_hash,status,email_verified_at_utc,created_at_utc,password_changed_at_utc) VALUES (@accountId,@email,@passwordHash,'ACTIVE',@now,@now,@now);`);
      } else {
        await new sql.Request(transaction).input("accountId", sql.UniqueIdentifier, accountId).input("now", sql.DateTime2(3), input.now).query(`UPDATE [C_identity].account SET status='ACTIVE', email_verified_at_utc=COALESCE(email_verified_at_utc,@now) WHERE account_id=@accountId AND status='PENDING_VERIFICATION';`);
      }

      const linked = await new sql.Request(transaction).input("tenantId", sql.UniqueIdentifier, invitation.tenantId).input("accountId", sql.UniqueIdentifier, accountId).query<{ personId: string }>(`SELECT person_id AS personId FROM [C_identity].account_person_link WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenantId AND account_id=@accountId AND status='ACTIVE';`);
      const personId = linked.recordset[0]?.personId ?? input.personId;
      if (linked.recordset[0] === undefined) {
        await new sql.Request(transaction).input("personId", sql.UniqueIdentifier, personId).input("tenantId", sql.UniqueIdentifier, invitation.tenantId).input("givenNames", sql.NVarChar(120), input.givenNames).input("familyName", sql.NVarChar(120), input.familyName).input("secondFamilyName", sql.NVarChar(120), input.secondFamilyName ?? null).input("email", sql.VarChar(320), invitation.targetEmail).input("phone", sql.VarChar(20), input.phoneE164 ?? null).input("now", sql.DateTime2(3), input.now).input("linkId", sql.UniqueIdentifier, input.linkId).input("accountId", sql.UniqueIdentifier, accountId).query(`
          INSERT INTO [C_identity].person (person_id,tenant_id,given_names,family_name,second_family_name,contact_email_normalized,phone_e164,created_at_utc) VALUES (@personId,@tenantId,@givenNames,@familyName,@secondFamilyName,@email,@phone,@now);
          INSERT INTO [C_identity].account_person_link (account_person_link_id,tenant_id,account_id,person_id,status,linked_at_utc) VALUES (@linkId,@tenantId,@accountId,@personId,'ACTIVE',@now);
        `);
      }
      const duplicate = await new sql.Request(transaction).input("tenantId", sql.UniqueIdentifier, invitation.tenantId).input("clubId", sql.UniqueIdentifier, invitation.clubId).input("personId", sql.UniqueIdentifier, personId).query(`SELECT membership_id FROM [C_membership].club_membership WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenantId AND club_id=@clubId AND person_id=@personId;`);
      if (duplicate.recordset.length > 0) { await transaction.rollback(); return "CONFLICT"; }

      await new sql.Request(transaction).input("membershipId", sql.UniqueIdentifier, input.membershipId).input("tenantId", sql.UniqueIdentifier, invitation.tenantId).input("clubId", sql.UniqueIdentifier, invitation.clubId).input("personId", sql.UniqueIdentifier, personId).input("eventId", sql.UniqueIdentifier, input.conditionEventId).input("now", sql.DateTime2(3), input.now).query(`
        INSERT INTO [C_membership].club_membership (membership_id,tenant_id,club_id,person_id,membership_status,member_condition,joined_at_utc) VALUES (@membershipId,@tenantId,@clubId,@personId,'PENDING','ASPIRANT',@now);
        INSERT INTO [C_membership].condition_event (condition_event_id,tenant_id,club_id,membership_id,previous_condition,new_condition,transition_method,occurred_at_utc) VALUES (@eventId,@tenantId,@clubId,@membershipId,NULL,'ASPIRANT','INITIAL_REGISTRATION',@now);
      `);
      await new sql.Request(transaction).input("invitationId", sql.UniqueIdentifier, invitation.invitationId).input("tokenId", sql.UniqueIdentifier, invitation.actionTokenId).input("accountId", sql.UniqueIdentifier, accountId).input("personId", sql.UniqueIdentifier, personId).input("membershipId", sql.UniqueIdentifier, input.membershipId).input("now", sql.DateTime2(3), input.now).query(`
        UPDATE [C_identity].action_token SET consumed_at_utc=@now WHERE action_token_id=@tokenId AND consumed_at_utc IS NULL AND revoked_at_utc IS NULL;
        UPDATE [C_membership].club_invitation SET status='ACCEPTED',accepted_at_utc=@now,accepted_account_id=@accountId,accepted_person_id=@personId,membership_id=@membershipId WHERE invitation_id=@invitationId AND status='PENDING';
      `);
      const response: InvitationResult = { accountId, personId, membershipId: input.membershipId, membershipStatus: "PENDING", memberCondition: "ASPIRANT", emailVerified: true, replayed: false };
      await this.writeIdempotency(transaction, invitation.tenantId, accountId, input.tokenHash, "ACCEPT_CLUB_INVITATION", input.idempotencyKey, input.requestHash, JSON.stringify(response), "CLUB_MEMBERSHIP", input.membershipId, input.now);
      await new sql.Request(transaction).input("tenantId", sql.UniqueIdentifier, invitation.tenantId).input("actor", sql.UniqueIdentifier, accountId).input("entityId", sql.NVarChar(100), input.membershipId).input("correlationId", sql.UniqueIdentifier, input.correlationId).input("after", sql.NVarChar(sql.MAX), JSON.stringify({ membershipStatus: "PENDING", memberCondition: "ASPIRANT", invitationId: invitation.invitationId })).input("now", sql.DateTime2(3), input.now).query(`INSERT INTO [C_audit].audit_event (tenant_id,actor_account_id,action,entity_type,entity_id,correlation_id,after_json,occurred_at_utc) VALUES (@tenantId,@actor,'CLUB_INVITATION_ACCEPTED','CLUB_MEMBERSHIP',@entityId,@correlationId,@after,@now);`);
      await transaction.commit();
      return response;
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  private async readIdempotency(transaction: sql.Transaction, tenantId: string, subjectHash: Buffer, operation: string, key: string): Promise<IdempotencyRow | null> {
    const result = await new sql.Request(transaction).input("tenantId", sql.UniqueIdentifier, tenantId).input("subjectHash", sql.VarBinary(32), subjectHash).input("operation", sql.VarChar(100), operation).input("key", sql.VarChar(100), key).query<IdempotencyRow>(`SELECT request_hash AS requestHash,response_json AS responseJson FROM [C_audit].idempotency_record WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenantId AND subject_hash=@subjectHash AND operation=@operation AND idempotency_key=@key AND status='COMPLETED';`);
    return result.recordset[0] ?? null;
  }

  private async writeIdempotency(transaction: sql.Transaction, tenantId: string, actorId: string, subjectHash: Buffer, operation: string, key: string, requestHash: Buffer, responseJson: string, resourceType: string, resourceId: string, now: Date): Promise<void> {
    await new sql.Request(transaction).input("id", sql.UniqueIdentifier, randomUUID()).input("tenantId", sql.UniqueIdentifier, tenantId).input("actor", sql.UniqueIdentifier, actorId).input("subjectHash", sql.VarBinary(32), subjectHash).input("operation", sql.VarChar(100), operation).input("key", sql.VarChar(100), key).input("requestHash", sql.VarBinary(32), requestHash).input("response", sql.NVarChar(sql.MAX), responseJson).input("resourceType", sql.VarChar(100), resourceType).input("resourceId", sql.NVarChar(100), resourceId).input("now", sql.DateTime2(3), now).query(`INSERT INTO [C_audit].idempotency_record (idempotency_record_id,tenant_id,actor_account_id,subject_hash,operation,idempotency_key,request_hash,status,response_status,response_json,resource_type,resource_id,created_at_utc,completed_at_utc,expires_at_utc) VALUES (@id,@tenantId,@actor,@subjectHash,@operation,@key,@requestHash,'COMPLETED',200,@response,@resourceType,@resourceId,@now,@now,DATEADD(day,7,@now));`);
  }
}
