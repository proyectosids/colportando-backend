import sql from "mssql";

import type { AccountRecord, ActionConsumeResult, ActionPurpose, AuthStore, RefreshResult } from "../application/ports/auth-store.js";

type AccountRow = Readonly<{ accountId: string; email: string; passwordHash: string | null; status: AccountRecord["status"] }>;
type RefreshRow = Readonly<{ tokenId: string; familyId: string; generation: number; consumedAt: Date | null; tokenRevokedAt: Date | null; tokenExpiresAt: Date; familyStatus: string; sessionId: string; accountId: string; email: string; sessionExpiresAt: Date; sessionRevokedAt: Date | null; accountStatus: AccountRecord["status"] }>;
type ActionRow = Readonly<{ actionTokenId: string; accountId: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null }>;

export class MssqlAuthStore implements AuthStore {
  public constructor(private readonly pool: sql.ConnectionPool) {}

  public async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    const result = await this.pool.request().input("email", sql.VarChar(320), email).query<AccountRow>(`
      SELECT account_id AS accountId, email_normalized AS email, password_hash AS passwordHash, status
      FROM [identity].account WHERE email_normalized = @email;
    `);
    return result.recordset[0] ?? null;
  }

  public async findActiveAccountBySession(accountId: string, sessionId: string, now: Date): Promise<AccountRecord | null> {
    const result = await this.pool.request().input("accountId", sql.UniqueIdentifier, accountId).input("sessionId", sql.UniqueIdentifier, sessionId).input("now", sql.DateTime2(3), now).query<AccountRow>(`
      SELECT a.account_id AS accountId, a.email_normalized AS email, a.password_hash AS passwordHash, a.status
      FROM [identity].account a
      JOIN [identity].auth_session s ON s.account_id=a.account_id
      WHERE a.account_id=@accountId AND a.status='ACTIVE' AND s.session_id=@sessionId AND s.revoked_at_utc IS NULL AND s.expires_at_utc>@now;
    `);
    return result.recordset[0] ?? null;
  }

  public async createSession(input: Parameters<AuthStore["createSession"]>[0]): Promise<void> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction);
      request.input("sessionId", sql.UniqueIdentifier, input.sessionId).input("familyId", sql.UniqueIdentifier, input.familyId).input("tokenId", sql.UniqueIdentifier, input.tokenId).input("accountId", sql.UniqueIdentifier, input.accountId).input("tokenHash", sql.VarBinary(32), input.tokenHash).input("now", sql.DateTime2(3), input.now).input("sessionExpires", sql.DateTime2(3), input.sessionExpiresAt).input("refreshExpires", sql.DateTime2(3), input.refreshExpiresAt).input("clientName", sql.NVarChar(120), input.context.clientName ?? null).input("ipAddress", sql.VarChar(45), input.context.ipAddress ?? null).input("userAgent", sql.NVarChar(500), input.context.userAgent ?? null);
      await request.query(`
        INSERT INTO [identity].auth_session (session_id, account_id, client_name, ip_address, user_agent, created_at_utc, last_seen_at_utc, expires_at_utc)
        VALUES (@sessionId, @accountId, @clientName, @ipAddress, @userAgent, @now, @now, @sessionExpires);
        INSERT INTO [identity].refresh_token_family (family_id, session_id, account_id, current_generation, created_at_utc)
        VALUES (@familyId, @sessionId, @accountId, 0, @now);
        INSERT INTO [identity].refresh_token (refresh_token_id, family_id, generation, token_hash, issued_at_utc, expires_at_utc)
        VALUES (@tokenId, @familyId, 0, @tokenHash, @now, @refreshExpires);
      `);
      await transaction.commit();
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async rotateRefreshToken(input: Parameters<AuthStore["rotateRefreshToken"]>[0]): Promise<RefreshResult> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const lookup = await new sql.Request(transaction).input("hash", sql.VarBinary(32), input.currentHash).query<RefreshRow>(`
        SELECT t.refresh_token_id AS tokenId, t.family_id AS familyId, t.generation, t.consumed_at_utc AS consumedAt,
          t.revoked_at_utc AS tokenRevokedAt, t.expires_at_utc AS tokenExpiresAt, f.status AS familyStatus,
          s.session_id AS sessionId, s.account_id AS accountId, a.email_normalized AS email,
          s.expires_at_utc AS sessionExpiresAt, s.revoked_at_utc AS sessionRevokedAt, a.status AS accountStatus
        FROM [identity].refresh_token t WITH (UPDLOCK, HOLDLOCK)
        JOIN [identity].refresh_token_family f WITH (UPDLOCK, HOLDLOCK) ON f.family_id=t.family_id
        JOIN [identity].auth_session s WITH (UPDLOCK, HOLDLOCK) ON s.session_id=f.session_id
        JOIN [identity].account a ON a.account_id=s.account_id
        WHERE t.token_hash=@hash;
      `);
      const row = lookup.recordset[0];
      if (row === undefined) { await transaction.commit(); return { outcome: "INVALID" }; }
      const reused = row.consumedAt !== null;
      const invalid = row.tokenRevokedAt !== null || row.familyStatus !== "ACTIVE" || row.sessionRevokedAt !== null || row.tokenExpiresAt <= input.now || row.sessionExpiresAt <= input.now || row.accountStatus !== "ACTIVE";
      if (reused || invalid) {
        await this.revokeFamily(transaction, row.familyId, row.sessionId, input.now, reused ? "TOKEN_REUSE" : "TOKEN_INVALID");
        await transaction.commit();
        return { outcome: reused ? "REUSED" : "INVALID" };
      }

      const nextGeneration = row.generation + 1;
      const request = new sql.Request(transaction).input("nextId", sql.UniqueIdentifier, input.nextTokenId).input("familyId", sql.UniqueIdentifier, row.familyId).input("generation", sql.Int, nextGeneration).input("nextHash", sql.VarBinary(32), input.nextHash).input("now", sql.DateTime2(3), input.now).input("expires", sql.DateTime2(3), input.refreshExpiresAt).input("oldId", sql.UniqueIdentifier, row.tokenId).input("sessionId", sql.UniqueIdentifier, row.sessionId);
      await request.query(`
        INSERT INTO [identity].refresh_token (refresh_token_id, family_id, generation, token_hash, issued_at_utc, expires_at_utc)
        VALUES (@nextId, @familyId, @generation, @nextHash, @now, @expires);
        UPDATE [identity].refresh_token SET consumed_at_utc=@now, replaced_by_token_id=@nextId WHERE refresh_token_id=@oldId AND consumed_at_utc IS NULL;
        UPDATE [identity].refresh_token_family SET current_generation=@generation WHERE family_id=@familyId;
        UPDATE [identity].auth_session SET last_seen_at_utc=@now WHERE session_id=@sessionId;
      `);
      await transaction.commit();
      return { outcome: "ROTATED", session: { accountId: row.accountId, email: row.email, sessionId: row.sessionId } };
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async revokeByRefreshToken(tokenHash: Buffer, now: Date): Promise<void> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin();
    try {
      const result = await new sql.Request(transaction).input("hash", sql.VarBinary(32), tokenHash).query<{ familyId: string; sessionId: string }>(`SELECT f.family_id AS familyId, f.session_id AS sessionId FROM [identity].refresh_token t JOIN [identity].refresh_token_family f ON f.family_id=t.family_id WHERE t.token_hash=@hash;`);
      const row = result.recordset[0]; if (row !== undefined) await this.revokeFamily(transaction, row.familyId, row.sessionId, now, "LOGOUT");
      await transaction.commit();
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async storeActionToken(input: Parameters<AuthStore["storeActionToken"]>[0]): Promise<void> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      await new sql.Request(transaction).input("tokenId", sql.UniqueIdentifier, input.tokenId).input("purpose", sql.VarChar(40), input.purpose).input("hash", sql.VarBinary(32), input.tokenHash).input("accountId", sql.UniqueIdentifier, input.accountId).input("email", sql.VarChar(320), input.email).input("now", sql.DateTime2(3), input.now).input("expires", sql.DateTime2(3), input.expiresAt).query(`
        UPDATE [identity].action_token SET revoked_at_utc=@now WHERE account_id=@accountId AND purpose=@purpose AND consumed_at_utc IS NULL AND revoked_at_utc IS NULL;
        INSERT INTO [identity].action_token (action_token_id,purpose,token_hash,account_id,target_email_normalized,issued_at_utc,expires_at_utc)
        VALUES (@tokenId,@purpose,@hash,@accountId,@email,@now,@expires);
      `);
      await transaction.commit();
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public consumeEmailVerification(tokenHash: Buffer, now: Date): Promise<ActionConsumeResult> { return this.consumeAction(tokenHash, now, "EMAIL_VERIFICATION", null); }
  public consumePasswordReset(tokenHash: Buffer, passwordHash: string, now: Date): Promise<ActionConsumeResult> { return this.consumeAction(tokenHash, now, "PASSWORD_RESET", passwordHash); }

  private async consumeAction(tokenHash: Buffer, now: Date, purpose: ActionPurpose, passwordHash: string | null): Promise<ActionConsumeResult> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction).input("hash", sql.VarBinary(32), tokenHash).input("purpose", sql.VarChar(40), purpose).query<ActionRow>(`SELECT action_token_id AS actionTokenId, account_id AS accountId, expires_at_utc AS expiresAt, consumed_at_utc AS consumedAt, revoked_at_utc AS revokedAt FROM [identity].action_token WITH (UPDLOCK,HOLDLOCK) WHERE token_hash=@hash AND purpose=@purpose;`);
      const row = result.recordset[0];
      if (row === undefined) { await transaction.commit(); return "INVALID"; }
      if (row.consumedAt !== null || row.revokedAt !== null) { await transaction.commit(); return "USED"; }
      if (row.expiresAt <= now) { await transaction.commit(); return "EXPIRED"; }
      const request = new sql.Request(transaction).input("tokenId", sql.UniqueIdentifier, row.actionTokenId).input("accountId", sql.UniqueIdentifier, row.accountId).input("now", sql.DateTime2(3), now);
      if (purpose === "EMAIL_VERIFICATION") {
        await request.query(`UPDATE [identity].account SET status='ACTIVE', email_verified_at_utc=COALESCE(email_verified_at_utc,@now) WHERE account_id=@accountId AND status='PENDING_VERIFICATION'; UPDATE [identity].action_token SET consumed_at_utc=@now WHERE action_token_id=@tokenId AND consumed_at_utc IS NULL;`);
      } else {
        request.input("passwordHash", sql.VarChar(255), passwordHash);
        await request.query(`
          UPDATE [identity].account SET password_hash=@passwordHash, password_changed_at_utc=@now WHERE account_id=@accountId AND status IN ('ACTIVE','LOCKED');
          UPDATE [identity].auth_session SET revoked_at_utc=COALESCE(revoked_at_utc,@now), revocation_reason=COALESCE(revocation_reason,'PASSWORD_RESET') WHERE account_id=@accountId;
          UPDATE [identity].refresh_token_family SET status='REVOKED', revoked_at_utc=COALESCE(revoked_at_utc,@now), revocation_reason=COALESCE(revocation_reason,'PASSWORD_RESET') WHERE account_id=@accountId;
          UPDATE t SET revoked_at_utc=COALESCE(t.revoked_at_utc,@now) FROM [identity].refresh_token t JOIN [identity].refresh_token_family f ON f.family_id=t.family_id WHERE f.account_id=@accountId;
          UPDATE [identity].action_token SET consumed_at_utc=@now WHERE action_token_id=@tokenId AND consumed_at_utc IS NULL;
        `);
      }
      await transaction.commit(); return "CONSUMED";
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  private async revokeFamily(transaction: sql.Transaction, familyId: string, sessionId: string, now: Date, reason: string): Promise<void> {
    await new sql.Request(transaction).input("familyId", sql.UniqueIdentifier, familyId).input("sessionId", sql.UniqueIdentifier, sessionId).input("now", sql.DateTime2(3), now).input("reason", sql.VarChar(40), reason).query(`
      UPDATE [identity].refresh_token_family SET status='REVOKED', revoked_at_utc=COALESCE(revoked_at_utc,@now), revocation_reason=COALESCE(revocation_reason,@reason) WHERE family_id=@familyId;
      UPDATE [identity].auth_session SET revoked_at_utc=COALESCE(revoked_at_utc,@now), revocation_reason=COALESCE(revocation_reason,@reason) WHERE session_id=@sessionId;
      UPDATE [identity].refresh_token SET revoked_at_utc=COALESCE(revoked_at_utc,@now) WHERE family_id=@familyId;
    `);
  }
}
