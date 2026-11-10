import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
  clientName: z.string().trim().min(1).max(120).optional()
}).strict();

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32).max(512) }).strict();
export const actionRequestSchema = z.object({ email: z.email().max(320) }).strict();
export const actionConfirmSchema = z.object({ email: z.email().max(320), code: z.string().regex(/^\d{8}$/) }).strict();
export const passwordResetConfirmSchema = actionConfirmSchema.extend({ newPassword: z.string().min(8).max(256) }).strict();

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive()
});

export const neutralActionResponseSchema = z.object({
  message: z.literal("If the account is eligible, delivery will be attempted.")
});

export const meResponseSchema = z.object({
  accountId: z.uuid(),
  email: z.email(),
  status: z.literal("ACTIVE"),
  sessionId: z.uuid()
});

export const createInvitationRequestSchema = z.object({
  clubId: z.uuid(),
  email: z.email().max(320)
}).strict();

export const invitationCodeSchema = z.object({ email: z.email().max(320), code: z.string().trim().regex(/^[A-Za-z0-9-]{12,15}$/) }).strict();
export const idempotencyKeySchema = z.string().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/);
export const idempotencyHeadersSchema = z.object({ "idempotency-key": idempotencyKeySchema });

export const acceptInvitationRequestSchema = z.object({
  email: z.email().max(320),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{12,15}$/),
  password: z.string().min(8).max(256),
  givenNames: z.string().trim().min(1).max(120),
  familyName: z.string().trim().min(1).max(120),
  secondFamilyName: z.string().trim().min(1).max(120).optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional()
}).strict();

export const invitationCreatedSchema = z.object({ invitationId: z.uuid(), status: z.literal("PENDING"), expiresAt: z.iso.datetime(), replayed: z.boolean() });
export const invitationContextSchema = z.object({ invitationId: z.uuid(), clubName: z.string(), institutionName: z.string(), emailHint: z.string(), expiresAt: z.iso.datetime() });
export const invitationAcceptedSchema = z.object({ accountId: z.uuid(), personId: z.uuid(), membershipId: z.uuid(), membershipStatus: z.literal("PENDING"), memberCondition: z.literal("ASPIRANT"), emailVerified: z.literal(true), replayed: z.boolean() });
