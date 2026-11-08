import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { ZodError, type ZodType } from "zod";

import type { AuthService } from "../../application/auth-service.js";
import { AppError } from "../../../../shared/presentation/http/errors/app-error.js";
import { actionConfirmSchema, actionRequestSchema, loginRequestSchema, passwordResetConfirmSchema, refreshRequestSchema } from "./auth-schemas.js";

const parse = <T>(schema: ZodType<T>, body: unknown): T => {
  try { return schema.parse(body); }
  catch (error) { if (error instanceof ZodError) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", error.issues); throw error; }
};

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => { Promise.resolve(handler(request, response, next)).catch(next); };

const neutralMessage = { message: "If the account is eligible, delivery will be attempted." } as const;

export function createAuthRouter(auth: AuthService): Router {
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

  return router;
}
