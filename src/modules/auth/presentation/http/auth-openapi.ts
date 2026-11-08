import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { errorResponseSchema } from "../../../../shared/presentation/http/schemas/error-schema.js";
import { actionConfirmSchema, actionRequestSchema, loginRequestSchema, meResponseSchema, neutralActionResponseSchema, passwordResetConfirmSchema, refreshRequestSchema, tokenPairSchema } from "./auth-schemas.js";

export function registerAuthOpenApi(registry: OpenAPIRegistry): void {
  const json = (schema: object) => ({ "application/json": { schema } });
  const errors = { 400: { description: "Invalid request or action token.", content: json(errorResponseSchema) }, 401: { description: "Authentication failed.", content: json(errorResponseSchema) }, 429: { description: "Rate limit exceeded.", content: json(errorResponseSchema) }, 500: { description: "Unexpected error.", content: json(errorResponseSchema) } };
  const add = (method: "post", path: string, operationId: string, summary: string, requestSchema: object, success: Record<number, object>) => registry.registerPath({ method, path, operationId, tags: ["Authentication"], summary, request: { body: { content: json(requestSchema) } }, responses: { ...success, ...errors } });

  add("post", "/api/v1/auth/login", "login", "Create an authenticated session", loginRequestSchema, { 200: { description: "Session created.", content: json(tokenPairSchema) } });
  add("post", "/api/v1/auth/refresh", "refreshSession", "Rotate a refresh token", refreshRequestSchema, { 200: { description: "Token rotated.", content: json(tokenPairSchema) } });
  add("post", "/api/v1/auth/logout", "logout", "Revoke a refresh-token family", refreshRequestSchema, { 204: { description: "Session revoked." } });
  add("post", "/api/v1/auth/email-verification/request", "requestEmailVerification", "Request email verification", actionRequestSchema, { 202: { description: "Neutral response.", content: json(neutralActionResponseSchema) } });
  add("post", "/api/v1/auth/email-verification/confirm", "confirmEmailVerification", "Confirm email verification", actionConfirmSchema, { 204: { description: "Email verified." } });
  add("post", "/api/v1/auth/password-reset/request", "requestPasswordReset", "Request password reset", actionRequestSchema, { 202: { description: "Neutral response.", content: json(neutralActionResponseSchema) } });
  add("post", "/api/v1/auth/password-reset/confirm", "confirmPasswordReset", "Reset password and revoke sessions", passwordResetConfirmSchema, { 204: { description: "Password changed." } });
  registry.registerPath({ method: "get", path: "/api/v1/auth/me", operationId: "getCurrentAccount", tags: ["Authentication"], summary: "Read the current authenticated account", security: [{ bearerAuth: [] }], responses: { 200: { description: "Current account.", content: json(meResponseSchema) }, 401: errors[401], 500: errors[500] } });
}
