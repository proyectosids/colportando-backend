import "dotenv/config";

import { randomUUID } from "node:crypto";

import type { ActionTokenDelivery } from "../src/modules/auth/application/ports/auth-crypto.js";
import type { ActionPurpose } from "../src/modules/auth/application/ports/auth-store.js";
import { AuthService } from "../src/modules/auth/application/auth-service.js";
import { ArgonPasswordHasher } from "../src/modules/auth/infrastructure/argon-password-hasher.js";
import { JoseAuthTokenCodec } from "../src/modules/auth/infrastructure/jose-auth-token-codec.js";
import { MssqlAuthStore } from "../src/modules/auth/infrastructure/mssql-auth-store.js";
import { loadConfig } from "../src/shared/infrastructure/config/env.js";
import { createConnectionPool } from "../src/shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "../src/shared/infrastructure/database/database-config.js";

class CapturingDelivery implements ActionTokenDelivery {
  public readonly tokens = new Map<ActionPurpose, string>();
  public deliver(input: Parameters<ActionTokenDelivery["deliver"]>[0]): Promise<void> {
    this.tokens.set(input.purpose, input.token);
    return Promise.resolve();
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createConnectionPool(loadDatabaseConfig());
  await pool.connect();
  const accountId = randomUUID();
  const email = `verify-auth-${randomUUID()}@example.invalid`;
  const passwords = new ArgonPasswordHasher();
  const delivery = new CapturingDelivery();
  const service = new AuthService(
    new MssqlAuthStore(pool),
    passwords,
    new JoseAuthTokenCodec(config.auth.jwtAccessSecret, config.auth.tokenPepper, config.auth.jwtIssuer, config.auth.jwtAudience),
    delivery,
    config.auth
  );

  try {
    const initialHash = await passwords.hash("Initial-password-123!");
    await pool.request().input("accountId", accountId).input("email", email).input("passwordHash", initialHash).query(`
      INSERT INTO [identity].account (account_id,email_normalized,password_hash,status)
      VALUES (@accountId,@email,@passwordHash,'PENDING_VERIFICATION');
    `);

    await service.requestAction(email, "EMAIL_VERIFICATION");
    const verificationToken = delivery.tokens.get("EMAIL_VERIFICATION");
    if (verificationToken === undefined) throw new Error("Verification token was not delivered");
    await service.verifyEmail(verificationToken);

    const firstPair = await service.login(email, "Initial-password-123!", { clientName: "database-verifier" });
    const identity = await service.authenticateAccessToken(firstPair.accessToken);
    if (identity.accountId.toLowerCase() !== accountId.toLowerCase()) throw new Error("Access token resolved the wrong account");

    const rotatedPair = await service.refresh(firstPair.refreshToken);
    let reuseRejected = false;
    try { await service.refresh(firstPair.refreshToken); }
    catch { reuseRejected = true; }
    if (!reuseRejected) throw new Error("Refresh token reuse was not rejected");

    let revokedAccessRejected = false;
    try { await service.authenticateAccessToken(rotatedPair.accessToken); }
    catch { revokedAccessRejected = true; }
    if (!revokedAccessRejected) throw new Error("Access token from a revoked session remained usable");

    await service.requestAction(email, "PASSWORD_RESET");
    const resetToken = delivery.tokens.get("PASSWORD_RESET");
    if (resetToken === undefined) throw new Error("Password reset token was not delivered");
    await service.resetPassword(resetToken, "Replacement-password-456!");
    const finalPair = await service.login(email, "Replacement-password-456!", { clientName: "database-verifier" });
    await service.logout(finalPair.refreshToken);

    process.stdout.write(`${JSON.stringify({ emailVerified: true, refreshRotated: true, reuseRejected, revokedAccessRejected, passwordReset: true, logoutRevoked: true })}\n`);
  } finally {
    try {
      await pool.request().input("accountId", accountId).query(`
        DELETE FROM [identity].action_token WHERE account_id=@accountId;
        DELETE t FROM [identity].refresh_token t JOIN [identity].refresh_token_family f ON f.family_id=t.family_id WHERE f.account_id=@accountId;
        DELETE FROM [identity].refresh_token_family WHERE account_id=@accountId;
        DELETE FROM [identity].auth_session WHERE account_id=@accountId;
        DELETE FROM [identity].account WHERE account_id=@accountId;
      `);
    } finally {
      await pool.close();
    }
  }
}

await main();
