export type InvitationContext = Readonly<{
  invitationId: string;
  tenantId: string;
  clubId: string;
  clubName: string;
  institutionName: string;
  targetEmail: string;
  expiresAt: Date;
}>;

export type InvitationResult = Readonly<{
  accountId: string;
  personId: string;
  membershipId: string;
  membershipStatus: "PENDING";
  memberCondition: "ASPIRANT";
  emailVerified: true;
  replayed: boolean;
}>;

export type CreateInvitationResult = Readonly<{
  invitationId: string;
  tenantId: string;
  clubId: string;
  clubName: string;
  institutionName: string;
  targetEmail: string;
  expiresAt: Date;
  replayed: boolean;
}>;

export interface InvitationStore {
  createInvitation(input: Readonly<{ actorAccountId: string; clubId: string; targetEmail: string; invitationId: string; actionTokenId: string; tokenHash: Buffer; now: Date; expiresAt: Date; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string }>): Promise<CreateInvitationResult | "FORBIDDEN" | "IDEMPOTENCY_CONFLICT">;
  inspectInvitation(tokenHash: Buffer, now: Date): Promise<InvitationContext | null>;
  findAcceptanceReplay(tokenHash: Buffer, idempotencyKey: string, requestHash: Buffer): Promise<InvitationResult | "IDEMPOTENCY_CONFLICT" | null>;
  acceptInvitation(input: Readonly<{ tokenHash: Buffer; existingAccountId?: string; newAccount?: Readonly<{ accountId: string; passwordHash: string }>; givenNames: string; familyName: string; secondFamilyName?: string; phoneE164?: string; personId: string; linkId: string; membershipId: string; conditionEventId: string; now: Date; idempotencyKey: string; requestHash: Buffer; correlationId: string }>): Promise<InvitationResult | "INVALID" | "CONFLICT" | "IDEMPOTENCY_CONFLICT">;
}
