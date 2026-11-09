import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import type { ActionTokenDelivery, AuthTokenCodec, PasswordHasher } from "./ports/auth-crypto.js";
import type { AuthStore } from "./ports/auth-store.js";
import type { InvitationStore } from "./ports/invitation-store.js";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ");

export class InvitationService {
  public constructor(
    private readonly invitations: InvitationStore,
    private readonly accounts: AuthStore,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AuthTokenCodec,
    private readonly delivery: ActionTokenDelivery,
    private readonly config: Readonly<{ invitationTtlSeconds: number; passwordMinLength: number }>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async create(input: Readonly<{ actorAccountId: string; clubId: string; email: string; idempotencyKey: string; correlationId: string }>) {
    const now = this.now();
    const targetEmail = normalizeEmail(input.email);
    const rawToken = this.tokens.createOpaqueToken();
    const expiresAt = new Date(now.getTime() + this.config.invitationTtlSeconds * 1_000);
    const result = await this.invitations.createInvitation({
      actorAccountId: input.actorAccountId,
      clubId: input.clubId,
      targetEmail,
      invitationId: randomUUID(),
      actionTokenId: randomUUID(),
      tokenHash: this.tokens.hashOpaqueToken(rawToken),
      now,
      expiresAt,
      idempotencyKey: input.idempotencyKey,
      requestHash: this.tokens.hashOpaqueToken(`invite:${input.clubId.toLowerCase()}:${targetEmail}`),
      subjectHash: this.tokens.hashOpaqueToken(`actor:${input.actorAccountId.toLowerCase()}`),
      correlationId: input.correlationId
    });
    if (result === "FORBIDDEN") throw new AppError(403, "INVITATION_FORBIDDEN", "Account is not allowed to invite members to this club");
    if (result === "IDEMPOTENCY_CONFLICT") throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request");
    if (!result.replayed) {
      await this.delivery.deliver({ purpose: "CLUB_INVITATION", email: result.targetEmail, token: rawToken, expiresAt: result.expiresAt, context: { clubName: result.clubName, institutionName: result.institutionName } });
    }
    return { invitationId: result.invitationId, status: "PENDING" as const, expiresAt: result.expiresAt.toISOString(), replayed: result.replayed };
  }

  public async inspect(token: string) {
    const context = await this.invitations.inspectInvitation(this.tokens.hashOpaqueToken(token), this.now());
    if (context === null) throw new AppError(404, "INVITATION_NOT_AVAILABLE", "Invitation is invalid or no longer available");
    const [local, domain] = context.targetEmail.split("@");
    const emailHint = `${local?.slice(0, 2) ?? ""}${"*".repeat(Math.max(3, (local?.length ?? 0) - 2))}@${domain ?? ""}`;
    return { invitationId: context.invitationId, clubName: context.clubName, institutionName: context.institutionName, emailHint, expiresAt: context.expiresAt.toISOString() };
  }

  public async accept(input: Readonly<{ token: string; password: string; givenNames: string; familyName: string; secondFamilyName?: string; phoneE164?: string; idempotencyKey: string; correlationId: string }>) {
    if (input.password.length < this.config.passwordMinLength) throw new AppError(400, "PASSWORD_POLICY_VIOLATION", `Password must contain at least ${String(this.config.passwordMinLength)} characters`);
    const tokenHash = this.tokens.hashOpaqueToken(input.token);
    const canonical = {
      givenNames: normalizeText(input.givenNames),
      familyName: normalizeText(input.familyName),
      secondFamilyName: input.secondFamilyName === undefined ? null : normalizeText(input.secondFamilyName),
      phoneE164: input.phoneE164 ?? null,
      passwordDigest: createHash("sha256").update(input.password, "utf8").digest("hex")
    };
    const requestHash = this.tokens.hashOpaqueToken(JSON.stringify(canonical));
    const replay = await this.invitations.findAcceptanceReplay(tokenHash, input.idempotencyKey, requestHash);
    if (replay === "IDEMPOTENCY_CONFLICT") throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request");
    if (replay !== null) return replay;

    const context = await this.invitations.inspectInvitation(tokenHash, this.now());
    if (context === null) throw new AppError(404, "INVITATION_NOT_AVAILABLE", "Invitation is invalid or no longer available");
    const existing = await this.accounts.findAccountByEmail(context.targetEmail);
    let existingAccountId: string | undefined;
    let newAccount: Readonly<{ accountId: string; passwordHash: string }> | undefined;
    if (existing === null) {
      newAccount = { accountId: randomUUID(), passwordHash: await this.passwords.hash(input.password) };
    } else {
      const valid = (existing.status === "ACTIVE" || existing.status === "PENDING_VERIFICATION") && await this.passwords.verify(input.password, existing.passwordHash);
      if (!valid) throw new AppError(401, "ACCOUNT_AUTHENTICATION_REQUIRED", "Account authentication is required to accept this invitation");
      existingAccountId = existing.accountId;
    }
    const result = await this.invitations.acceptInvitation({
      tokenHash,
      ...(existingAccountId === undefined ? {} : { existingAccountId }),
      ...(newAccount === undefined ? {} : { newAccount }),
      givenNames: canonical.givenNames,
      familyName: canonical.familyName,
      ...(canonical.secondFamilyName === null ? {} : { secondFamilyName: canonical.secondFamilyName }),
      ...(canonical.phoneE164 === null ? {} : { phoneE164: canonical.phoneE164 }),
      personId: randomUUID(),
      linkId: randomUUID(),
      membershipId: randomUUID(),
      conditionEventId: randomUUID(),
      now: this.now(),
      idempotencyKey: input.idempotencyKey,
      requestHash,
      correlationId: input.correlationId
    });
    if (result === "INVALID") throw new AppError(404, "INVITATION_NOT_AVAILABLE", "Invitation is invalid or no longer available");
    if (result === "CONFLICT") throw new AppError(409, "INVITATION_CONFLICT", "Invitation cannot be accepted for this account or membership");
    if (result === "IDEMPOTENCY_CONFLICT") throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request");
    return result;
  }
}
