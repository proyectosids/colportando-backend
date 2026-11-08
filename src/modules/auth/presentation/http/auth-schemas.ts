import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
  clientName: z.string().trim().min(1).max(120).optional()
}).strict();

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32).max(512) }).strict();
export const actionRequestSchema = z.object({ email: z.email().max(320) }).strict();
export const actionConfirmSchema = z.object({ token: z.string().min(32).max(512) }).strict();
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
