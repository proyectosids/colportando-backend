import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { ZodError, type ZodType } from "zod";

import type { AuthService } from "../../application/auth-service.js";
import type { InvitationService } from "../../application/invitation-service.js";
import { AppError } from "../../../../shared/presentation/http/errors/app-error.js";
import { acceptInvitationRequestSchema, actionConfirmSchema, actionRequestSchema, createInvitationRequestSchema, idempotencyKeySchema, invitationTokenParamsSchema, loginRequestSchema, passwordResetConfirmSchema, refreshRequestSchema } from "./auth-schemas.js";

const parse = <T>(schema: ZodType<T>, body: unknown): T => {
  try { return schema.parse(body); }
  catch (error) { if (error instanceof ZodError) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", error.issues); throw error; }
};

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => { Promise.resolve(handler(request, response, next)).catch(next); };

const neutralMessage = { message: "If the account is eligible, delivery will be attempted." } as const;

export function createAuthRouter(auth: AuthService, invitations?: InvitationService): Router {
  const router = Router();
  const sensitiveLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({ error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests", correlationId: response.locals.correlationId as string } });
    }
  });

  router.post("/auth/login", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(loginRequestSchema, request.body);
    const userAgent = request.get("user-agent")?.slice(0, 500);
    response.status(200).json(await auth.login(input.email, input.password, {
      ...(input.clientName === undefined ? {} : { clientName: input.clientName }),
      ...(request.ip === undefined ? {} : { ipAddress: request.ip }),
      ...(userAgent === undefined ? {} : { userAgent })
    }));
  }));
  router.post("/auth/refresh", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(refreshRequestSchema, request.body);
    response.status(200).json(await auth.refresh(input.refreshToken));
  }));
  router.post("/auth/logout", asyncHandler(async (request, response) => {
    const input = parse(refreshRequestSchema, request.body);
    await auth.logout(input.refreshToken); response.status(204).send();
  }));
  router.post("/auth/email-verification/request", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(actionRequestSchema, request.body); await auth.requestAction(input.email, "EMAIL_VERIFICATION"); response.status(202).json(neutralMessage);
  }));
  router.post("/auth/email-verification/confirm", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(actionConfirmSchema, request.body); await auth.verifyEmail(input.token); response.status(204).send();
  }));
  router.post("/auth/password-reset/request", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(actionRequestSchema, request.body); await auth.requestAction(input.email, "PASSWORD_RESET"); response.status(202).json(neutralMessage);
  }));
  router.post("/auth/password-reset/confirm", sensitiveLimit, asyncHandler(async (request, response) => {
    const input = parse(passwordResetConfirmSchema, request.body); await auth.resetPassword(input.token, input.newPassword); response.status(204).send();
  }));
  router.get("/auth/me", asyncHandler(async (request, response) => {
    const authorization = request.get("authorization");
    if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid");
    response.status(200).json(await auth.authenticateAccessToken(authorization.slice(7)));
  }));

  if (invitations !== undefined) {
    router.post("/auth/invitations", sensitiveLimit, asyncHandler(async (request, response) => {
      const authorization = request.get("authorization");
      if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid");
      const actor = await auth.authenticateAccessToken(authorization.slice(7));
      const body = parse(createInvitationRequestSchema, request.body);
      const idempotencyKey = parse(idempotencyKeySchema, request.get("idempotency-key"));
      const result = await invitations.create({ actorAccountId: actor.accountId, clubId: body.clubId, email: body.email, idempotencyKey, correlationId: response.locals.correlationId as string });
      response.status(result.replayed ? 200 : 202).json(result);
    }));
    router.get("/auth/invitations/:token", sensitiveLimit, asyncHandler(async (request, response) => {
      const { token } = parse(invitationTokenParamsSchema, request.params);
      response.status(200).json(await invitations.inspect(token));
    }));
    router.post("/auth/invitations/:token/accept", sensitiveLimit, asyncHandler(async (request, response) => {
      const { token } = parse(invitationTokenParamsSchema, request.params);
      const body = parse(acceptInvitationRequestSchema, request.body);
      const idempotencyKey = parse(idempotencyKeySchema, request.get("idempotency-key"));
      const result = await invitations.accept({
        token,
        password: body.password,
        givenNames: body.givenNames,
        familyName: body.familyName,
        ...(body.secondFamilyName === undefined ? {} : { secondFamilyName: body.secondFamilyName }),
        ...(body.phoneE164 === undefined ? {} : { phoneE164: body.phoneE164 }),
        idempotencyKey,
        correlationId: response.locals.correlationId as string
      });
      response.status(result.replayed ? 200 : 201).json(result);
    }));
  }

  return router;
}
