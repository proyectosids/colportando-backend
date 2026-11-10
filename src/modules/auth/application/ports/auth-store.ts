export type AccountRecord = Readonly<{
  accountId: string;
  email: string;
  passwordHash: string | null;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
}>;

export type SessionContext = Readonly<{
  clientName?: string;
  ipAddress?: string;
  userAgent?: string;
}>;

export type SessionRecord = Readonly<{
  accountId: string;
  email: string;
  sessionId: string;
}>;

export type RefreshResult =
  | Readonly<{ outcome: "ROTATED"; session: SessionRecord }>
  | Readonly<{ outcome: "INVALID" | "REUSED" }>;

export type ActionPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "CLUB_INVITATION";
export type AccountActionPurpose = Exclude<ActionPurpose, "CLUB_INVITATION">;

export type ActionConsumeResult = "CONSUMED" | "INVALID" | "EXPIRED" | "USED" | "ATTEMPTS_EXCEEDED";
export type ActionStoreResult = "STORED" | "TOO_SOON";

export interface AuthStore {
  findAccountByEmail(email: string): Promise<AccountRecord | null>;
  findActiveAccountBySession(accountId: string, sessionId: string, now: Date): Promise<AccountRecord | null>;
  createSession(input: Readonly<{ accountId: string; sessionId: string; familyId: string; tokenId: string; tokenHash: Buffer; now: Date; sessionExpiresAt: Date; refreshExpiresAt: Date; context: SessionContext }>): Promise<void>;
  rotateRefreshToken(input: Readonly<{ currentHash: Buffer; nextHash: Buffer; nextTokenId: string; now: Date; refreshExpiresAt: Date }>): Promise<RefreshResult>;
  revokeByRefreshToken(tokenHash: Buffer, now: Date): Promise<void>;
  storeActionToken(input: Readonly<{ tokenId: string; purpose: AccountActionPurpose; tokenHash: Buffer; accountId: string; email: string; now: Date; expiresAt: Date; maxAttempts: number; resendAfterSeconds: number }>): Promise<ActionStoreResult>;
  consumeEmailVerification(email: string, tokenHash: Buffer, now: Date): Promise<ActionConsumeResult>;
  consumePasswordReset(email: string, tokenHash: Buffer, passwordHash: string, now: Date): Promise<ActionConsumeResult>;
}
