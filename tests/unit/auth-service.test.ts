import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../../src/modules/auth/application/auth-service.js";
import type { ActionTokenDelivery, AuthTokenCodec, PasswordHasher } from "../../src/modules/auth/application/ports/auth-crypto.js";
import type { AuthStore } from "../../src/modules/auth/application/ports/auth-store.js";
import { AppError } from "../../src/shared/presentation/http/errors/app-error.js";

const activeAccount = { accountId: "3f65cecc-67ee-4a0d-aa52-d8eac572e76e", email: "member@example.com", passwordHash: "hash", status: "ACTIVE" as const };

function createStore(overrides: Partial<AuthStore> = {}): AuthStore {
  return {
    findAccountByEmail: vi.fn().mockResolvedValue(activeAccount),
    findActiveAccountBySession: vi.fn().mockResolvedValue(activeAccount),
    createSession: vi.fn().mockResolvedValue(undefined),
    rotateRefreshToken: vi.fn().mockResolvedValue({ outcome: "ROTATED", session: { accountId: activeAccount.accountId, email: activeAccount.email, sessionId: "7b9d589b-a323-42ce-8704-579cb950026d" } }),
    revokeByRefreshToken: vi.fn().mockResolvedValue(undefined),
    storeActionToken: vi.fn().mockResolvedValue(undefined),
    consumeEmailVerification: vi.fn().mockResolvedValue("CONSUMED"),
    consumePasswordReset: vi.fn().mockResolvedValue("CONSUMED"),
    ...overrides
  };
}

function createService(store: AuthStore, delivery: ActionTokenDelivery = { deliver: vi.fn().mockResolvedValue(undefined) }) {
  let opaqueSequence = 0;
  const passwords: PasswordHasher = {
    hash: vi.fn().mockResolvedValue("new-hash"),
    verify: vi.fn().mockResolvedValue(true)
  };
  const tokens: AuthTokenCodec = {
    createOpaqueToken: () => `opaque-token-${String(++opaqueSequence).padStart(32, "x")}`,
    hashOpaqueToken: (token) => Buffer.from(token.padEnd(32, "0").slice(0, 32)),
    issueAccessToken: vi.fn().mockResolvedValue("access-token"),
    verifyAccessToken: vi.fn().mockResolvedValue({ accountId: activeAccount.accountId, sessionId: "7b9d589b-a323-42ce-8704-579cb950026d" })
  };
  return new AuthService(store, passwords, tokens, delivery, { accessTtlSeconds: 900, refreshTtlSeconds: 2_592_000, sessionTtlSeconds: 7_776_000, actionTokenTtlSeconds: 3_600, passwordMinLength: 12 }, () => new Date("2026-11-08T20:00:00.000Z"));
}

describe("AuthService", () => {
  it("creates a session and returns an access/refresh pair for an active account", async () => {
    const store = createStore();
    const result = await createService(store).login(" Member@Example.com ", "correct-password", { clientName: "Flutter" });
    expect(result).toMatchObject({ accessToken: "access-token", tokenType: "Bearer", expiresIn: 900 });
    expect(result.refreshToken).toHaveLength(45);
    // Interface methods are Vitest mocks in this fixture; they do not depend on `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.findAccountByEmail)).toHaveBeenCalledWith("member@example.com");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.createSession)).toHaveBeenCalledOnce();
  });

  it("uses one generic error for unknown accounts", async () => {
    const store = createStore({ findAccountByEmail: vi.fn().mockResolvedValue(null) });
    await expect(createService(store).login("missing@example.com", "wrong-password", {})).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", statusCode: 401 });
  });

  it("reports refresh reuse and relies on the store to revoke the family atomically", async () => {
    const store = createStore({ rotateRefreshToken: vi.fn().mockResolvedValue({ outcome: "REUSED" }) });
    await expect(createService(store).refresh("old-refresh-token-that-is-long-enough")).rejects.toMatchObject({ code: "REFRESH_TOKEN_REUSED", statusCode: 401 });
  });

  it("does not reveal whether a recovery account exists", async () => {
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = createService(createStore({ findAccountByEmail: vi.fn().mockResolvedValue(null) }), delivery);
    await service.requestAction("missing@example.com", "PASSWORD_RESET");
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it("enforces the password policy before consuming a reset token", async () => {
    const store = createStore();
    await expect(createService(store).resetPassword("reset-token-that-is-long-enough", "short")).rejects.toBeInstanceOf(AppError);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.consumePasswordReset)).not.toHaveBeenCalled();
  });

  it("rejects an access token whose session is no longer active", async () => {
    const store = createStore({ findActiveAccountBySession: vi.fn().mockResolvedValue(null) });
    await expect(createService(store).authenticateAccessToken("signed-token")).rejects.toMatchObject({ code: "INVALID_ACCESS_TOKEN", statusCode: 401 });
  });
});
