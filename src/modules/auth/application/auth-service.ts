import { randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import type { ActionTokenDelivery, AuthTokenCodec, PasswordHasher } from "./ports/auth-crypto.js";
import type { AccountActionPurpose, AuthStore, SessionContext } from "./ports/auth-store.js";

export type AuthServiceConfig = Readonly<{
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  sessionTtlSeconds: number;
  actionTokenTtlSeconds: number;
  passwordMinLength: number;
}>;

export type TokenPair = Readonly<{ accessToken: string; refreshToken: string; tokenType: "Bearer"; expiresIn: number }>;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const addSeconds = (date: Date, seconds: number): Date => new Date(date.getTime() + seconds * 1_000);

export class AuthService {
  public constructor(
    private readonly store: AuthStore,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AuthTokenCodec,
    private readonly delivery: ActionTokenDelivery,
    private readonly config: AuthServiceConfig,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async login(email: string, password: string, context: SessionContext): Promise<TokenPair> {
    const account = await this.store.findAccountByEmail(normalizeEmail(email));
    const passwordValid = await this.passwords.verify(password, account?.passwordHash ?? null);
    if (!passwordValid || account?.status !== "ACTIVE") {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const timestamp = this.now();
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const tokenId = randomUUID();
    const refreshToken = this.tokens.createOpaqueToken();
    const accessExpiresAt = addSeconds(timestamp, this.config.accessTtlSeconds);
    await this.store.createSession({
      accountId: account.accountId,
      sessionId,
      familyId,
      tokenId,
      tokenHash: this.tokens.hashOpaqueToken(refreshToken),
      now: timestamp,
      sessionExpiresAt: addSeconds(timestamp, this.config.sessionTtlSeconds),
      refreshExpiresAt: addSeconds(timestamp, this.config.refreshTtlSeconds),
      context
    });

    return {
      accessToken: await this.tokens.issueAccessToken({ accountId: account.accountId, sessionId, expiresAt: accessExpiresAt }),
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessTtlSeconds
    };
  }

  public async refresh(refreshToken: string): Promise<TokenPair> {
    const timestamp = this.now();
    const nextRefreshToken = this.tokens.createOpaqueToken();
    const result = await this.store.rotateRefreshToken({
      currentHash: this.tokens.hashOpaqueToken(refreshToken),
      nextHash: this.tokens.hashOpaqueToken(nextRefreshToken),
      nextTokenId: randomUUID(),
      now: timestamp,
      refreshExpiresAt: addSeconds(timestamp, this.config.refreshTtlSeconds)
    });
    if (result.outcome !== "ROTATED") {
      throw new AppError(401, result.outcome === "REUSED" ? "REFRESH_TOKEN_REUSED" : "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
    }

    return {
      accessToken: await this.tokens.issueAccessToken({ accountId: result.session.accountId, sessionId: result.session.sessionId, expiresAt: addSeconds(timestamp, this.config.accessTtlSeconds) }),
      refreshToken: nextRefreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessTtlSeconds
    };
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.store.revokeByRefreshToken(this.tokens.hashOpaqueToken(refreshToken), this.now());
  }

  public async requestAction(email: string, purpose: AccountActionPurpose): Promise<void> {
    const account = await this.store.findAccountByEmail(normalizeEmail(email));
    if (
      account === null ||
      (purpose === "EMAIL_VERIFICATION" && account.status !== "PENDING_VERIFICATION") ||
      (purpose === "PASSWORD_RESET" && account.status !== "ACTIVE" && account.status !== "LOCKED")
    ) return;

    const timestamp = this.now();
    const rawToken = this.tokens.createOpaqueToken();
    const expiresAt = addSeconds(timestamp, this.config.actionTokenTtlSeconds);
    await this.store.storeActionToken({ tokenId: randomUUID(), purpose, tokenHash: this.tokens.hashOpaqueToken(rawToken), accountId: account.accountId, email: account.email, now: timestamp, expiresAt });
    await this.delivery.deliver({ purpose, email: account.email, token: rawToken, expiresAt });
  }

  public async verifyEmail(token: string): Promise<void> {
    this.assertActionResult(await this.store.consumeEmailVerification(this.tokens.hashOpaqueToken(token), this.now()));
  }

  public async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < this.config.passwordMinLength) {
      throw new AppError(400, "PASSWORD_POLICY_VIOLATION", `Password must contain at least ${String(this.config.passwordMinLength)} characters`);
    }
    const passwordHash = await this.passwords.hash(newPassword);
    this.assertActionResult(await this.store.consumePasswordReset(this.tokens.hashOpaqueToken(token), passwordHash, this.now()));
  }

  public async authenticateAccessToken(token: string) {
    try {
      const claims = await this.tokens.verifyAccessToken(token);
      const account = await this.store.findActiveAccountBySession(claims.accountId, claims.sessionId, this.now());
      if (account === null) throw new Error("Inactive session");
      return { accountId: account.accountId, sessionId: claims.sessionId, email: account.email, status: account.status } as const;
    } catch {
      throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid");
    }
  }

  private assertActionResult(result: "CONSUMED" | "INVALID" | "EXPIRED" | "USED"): void {
    if (result === "CONSUMED") return;
    const code = result === "EXPIRED" ? "ACTION_TOKEN_EXPIRED" : result === "USED" ? "ACTION_TOKEN_USED" : "INVALID_ACTION_TOKEN";
    throw new AppError(400, code, "Action token is invalid or no longer usable");
  }
}
