import { describe, expect, it, vi } from "vitest";

import { InvitationService } from "../../src/modules/auth/application/invitation-service.js";
import type { ActionTokenDelivery, AuthTokenCodec, PasswordHasher } from "../../src/modules/auth/application/ports/auth-crypto.js";
import type { AuthStore } from "../../src/modules/auth/application/ports/auth-store.js";
import type { InvitationStore } from "../../src/modules/auth/application/ports/invitation-store.js";

const context = { invitationId: "8b362786-e89a-42bd-b527-ccac260fcd2f", tenantId: "b0641547-c7f6-4ed9-b1dd-2de23c7c46c4", clubId: "1454389c-dc3c-411a-ad84-1f2e294470bc", clubName: "Club Central", institutionName: "Universidad Linda Vista", targetEmail: "aspirant@example.com", expiresAt: new Date("2026-11-15T20:00:00.000Z") };

function fixtures(overrides: Partial<InvitationStore> = {}) {
  const createInvitation = vi.fn().mockResolvedValue({ ...context, replayed: false });
  const acceptInvitation = vi.fn().mockResolvedValue({ accountId: "616ef081-6319-4c77-99d7-445bc64022fc", personId: "93932f10-8732-449c-b7fb-6530fd8aa782", membershipId: "7f7bdfcb-8798-470b-9859-30840a6fb860", membershipStatus: "PENDING", memberCondition: "ASPIRANT", emailVerified: true, replayed: false });
  const store: InvitationStore = {
    createInvitation,
    inspectInvitation: vi.fn().mockResolvedValue(context),
    findAcceptanceReplay: vi.fn().mockResolvedValue(null),
    acceptInvitation,
    ...overrides
  };
  const accounts: AuthStore = {
    findAccountByEmail: vi.fn().mockResolvedValue(null),
    findActiveAccountBySession: vi.fn(), createSession: vi.fn(), rotateRefreshToken: vi.fn(), revokeByRefreshToken: vi.fn(), storeActionToken: vi.fn(), consumeEmailVerification: vi.fn(), consumePasswordReset: vi.fn()
  };
  const passwords: PasswordHasher = { hash: vi.fn().mockResolvedValue("argon-hash"), verify: vi.fn().mockResolvedValue(true) };
  const tokens: AuthTokenCodec = {
    createOpaqueToken: () => "opaque-invitation-token-with-enough-entropy",
    hashOpaqueToken: (value) => Buffer.from(value.padEnd(32, "0").slice(0, 32)),
    issueAccessToken: vi.fn(), verifyAccessToken: vi.fn()
  };
  const delivery = { deliver: vi.fn().mockResolvedValue(undefined) } satisfies ActionTokenDelivery;
  const service = new InvitationService(store, accounts, passwords, tokens, delivery, { invitationTtlSeconds: 604_800, passwordMinLength: 12 }, () => new Date("2026-11-08T20:00:00.000Z"));
  return { service, createInvitation, acceptInvitation, delivery };
}

describe("InvitationService", () => {
  it("creates a participant-only invitation and sends club context", async () => {
    const { service, createInvitation, delivery } = fixtures();
    const result = await service.create({ actorAccountId: "616ef081-6319-4c77-99d7-445bc64022fc", clubId: context.clubId, email: " Aspirant@Example.com ", idempotencyKey: "invite-request-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" });
    expect(result).toMatchObject({ invitationId: context.invitationId, status: "PENDING", replayed: false });
    expect(createInvitation).toHaveBeenCalledWith(expect.objectContaining({ targetEmail: "aspirant@example.com", clubId: context.clubId }));
    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ purpose: "CLUB_INVITATION", context: { clubName: "Club Central", institutionName: "Universidad Linda Vista" } }));
  });

  it("does not resend an email for an idempotent replay", async () => {
    const { service, delivery } = fixtures({ createInvitation: vi.fn().mockResolvedValue({ ...context, replayed: true }) });
    const result = await service.create({ actorAccountId: "616ef081-6319-4c77-99d7-445bc64022fc", clubId: context.clubId, email: context.targetEmail, idempotencyKey: "invite-request-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" });
    expect(result.replayed).toBe(true);
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it("accepts a new account only as a pending aspirant", async () => {
    const { service, acceptInvitation } = fixtures();
    const result = await service.accept({ token: "opaque-invitation-token-with-enough-entropy", password: "Secure-password-123!", givenNames: "Ana", familyName: "López", idempotencyKey: "accept-request-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" });
    expect(result).toMatchObject({ membershipStatus: "PENDING", memberCondition: "ASPIRANT", emailVerified: true });
    const acceptedInput = acceptInvitation.mock.calls[0]?.[0] as Parameters<InvitationStore["acceptInvitation"]>[0] | undefined;
    expect(acceptedInput).toMatchObject({ givenNames: "Ana", familyName: "López", newAccount: { passwordHash: "argon-hash" } });
  });

  it("returns an idempotent acceptance before inspecting a consumed token", async () => {
    const replay = { accountId: "616ef081-6319-4c77-99d7-445bc64022fc", personId: "93932f10-8732-449c-b7fb-6530fd8aa782", membershipId: "7f7bdfcb-8798-470b-9859-30840a6fb860", membershipStatus: "PENDING" as const, memberCondition: "ASPIRANT" as const, emailVerified: true as const, replayed: true };
    const inspectInvitation = vi.fn().mockResolvedValue(null);
    const { service } = fixtures({ findAcceptanceReplay: vi.fn().mockResolvedValue(replay), inspectInvitation });
    expect(await service.accept({ token: "opaque-invitation-token-with-enough-entropy", password: "Secure-password-123!", givenNames: "Ana", familyName: "López", idempotencyKey: "accept-request-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" })).toEqual(replay);
    expect(inspectInvitation).not.toHaveBeenCalled();
  });
});
