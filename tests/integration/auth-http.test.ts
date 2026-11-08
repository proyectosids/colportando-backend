import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/composition/create-app.js";
import { AuthService } from "../../src/modules/auth/application/auth-service.js";
import type { AuthTokenCodec, PasswordHasher } from "../../src/modules/auth/application/ports/auth-crypto.js";
import type { AuthStore } from "../../src/modules/auth/application/ports/auth-store.js";
import type { AppConfig } from "../../src/shared/infrastructure/config/env.js";
import { errorResponseSchema } from "../../src/shared/presentation/http/schemas/error-schema.js";

const account = { accountId: "3f65cecc-67ee-4a0d-aa52-d8eac572e76e", email: "member@example.com", passwordHash: "hash", status: "ACTIVE" as const };
const sessionId = "7b9d589b-a323-42ce-8704-579cb950026d";

function dependencies() {
  const store: AuthStore = {
    findAccountByEmail: vi.fn().mockResolvedValue(account),
    findActiveAccountBySession: vi.fn().mockResolvedValue(account),
    createSession: vi.fn().mockResolvedValue(undefined),
    rotateRefreshToken: vi.fn().mockResolvedValue({ outcome: "ROTATED", session: { accountId: account.accountId, email: account.email, sessionId } }),
    revokeByRefreshToken: vi.fn().mockResolvedValue(undefined),
    storeActionToken: vi.fn().mockResolvedValue(undefined),
    consumeEmailVerification: vi.fn().mockResolvedValue("CONSUMED"),
    consumePasswordReset: vi.fn().mockResolvedValue("CONSUMED")
  };
  const passwords: PasswordHasher = { hash: vi.fn().mockResolvedValue("new-hash"), verify: vi.fn().mockResolvedValue(true) };
  const tokens: AuthTokenCodec = {
    createOpaqueToken: () => "opaque-refresh-token-value-with-32-characters",
    hashOpaqueToken: () => Buffer.alloc(32, 1),
    issueAccessToken: vi.fn().mockResolvedValue("signed-access-token"),
    verifyAccessToken: vi.fn().mockResolvedValue({ accountId: account.accountId, sessionId })
  };
  const config: AppConfig = {
    nodeEnv: "test", port: 3000, logLevel: "silent", trustProxy: false, corsAllowedOrigins: ["https://app.example"], swaggerEnabled: true,
    auth: { jwtIssuer: "test", jwtAudience: "test", jwtAccessSecret: "test-access-secret-at-least-32-characters", accessTtlSeconds: 900, tokenPepper: "test-token-pepper-at-least-32-characters", refreshTtlSeconds: 2_592_000, sessionTtlSeconds: 7_776_000, actionTokenTtlSeconds: 3_600, passwordMinLength: 12 }
  };
  const authService = new AuthService(store, passwords, tokens, { deliver: vi.fn().mockResolvedValue(undefined) }, config.auth, () => new Date("2026-11-08T20:00:00.000Z"));
  return { app: createApp({ config, logger: pino({ level: "silent" }), authService }), store };
}

describe("authentication HTTP API", () => {
  it("creates a session without exposing stored hashes", async () => {
    const { app, store } = dependencies();
    const response = await request(app).post("/api/v1/auth/login").send({ email: "member@example.com", password: "Valid-password-123!", clientName: "Flutter" }).expect(200);
    expect(response.body).toMatchObject({ accessToken: "signed-access-token", tokenType: "Bearer", expiresIn: 900 });
    expect(response.body).not.toHaveProperty("passwordHash");
    // Interface methods are Vitest mocks in this fixture; they do not depend on `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.createSession)).toHaveBeenCalledOnce();
  });

  it("returns a neutral recovery response", async () => {
    const { app } = dependencies();
    const response = await request(app).post("/api/v1/auth/password-reset/request").send({ email: "member@example.com" }).expect(202);
    expect(response.body).toEqual({ message: "If the account is eligible, delivery will be attempted." });
  });

  it("validates bearer tokens against an active database session", async () => {
    const { app } = dependencies();
    const response = await request(app).get("/api/v1/auth/me").set("authorization", "Bearer signed-access-token").expect(200);
    expect(response.body).toMatchObject({ accountId: account.accountId, email: account.email, status: "ACTIVE", sessionId });
  });

  it("returns the standard validation envelope", async () => {
    const { app } = dependencies();
    const response = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email", password: "" }).expect(400);
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe("VALIDATION_ERROR");
  });
});
