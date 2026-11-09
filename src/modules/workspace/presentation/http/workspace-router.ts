import { Router, type RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";

import type { AuthService } from "../../../auth/application/auth-service.js";
import type { WorkspaceService } from "../../application/workspace-service.js";
import { AppError } from "../../../../shared/presentation/http/errors/app-error.js";
import { assignAccessSchema, assignmentParams, campaignParams, clubParams, idempotencyHeaders, pageQuery, revokeAccessSchema } from "./workspace-schemas.js";

const parse = <T>(schema: ZodType<T>, value: unknown): T => { try { return schema.parse(value); } catch (error) { if (error instanceof ZodError) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", error.issues); throw error; } };
const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => { Promise.resolve(handler(request, response, next)).catch(next); };
export function createWorkspaceRouter(auth: AuthService, workspace: WorkspaceService): Router {
  const router = Router();
  const actor = async (authorization: string | undefined) => { if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid"); return auth.authenticateAccessToken(authorization.slice(7)); };
  const meta = (request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1]) => ({ idempotencyKey: parse(idempotencyHeaders, { "idempotency-key": request.get("idempotency-key") })["idempotency-key"], correlationId: response.locals.correlationId as string });
  router.get("/workspace/context", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); response.status(200).json(await workspace.getContext(account.accountId)); }));
  router.get("/workspace/clubs/:clubId/memberships", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(clubParams, request.params); const query = parse(pageQuery, request.query); response.status(200).json(await workspace.listMemberships(account.accountId, params.clubId, query.page, query.pageSize, query.search)); }));
  router.get("/workspace/clubs/:clubId/campaigns", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(clubParams, request.params); const query = parse(pageQuery.omit({ search: true }), request.query); response.status(200).json(await workspace.listCampaigns(account.accountId, params.clubId, query.page, query.pageSize)); }));
  router.get("/workspace/campaigns/:campaignId/groups", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(campaignParams, request.params); const query = parse(pageQuery.omit({ search: true }), request.query); response.status(200).json(await workspace.listCampaignGroups(account.accountId, params.campaignId, query.page, query.pageSize)); }));
  router.get("/workspace/clubs/:clubId/training-programs", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(clubParams, request.params); const query = parse(pageQuery.omit({ search: true }), request.query); response.status(200).json(await workspace.listTrainingPrograms(account.accountId, params.clubId, query.page, query.pageSize)); }));
  router.get("/workspace/clubs/:clubId/roles", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(clubParams, request.params); response.status(200).json(await workspace.listAssignableRoles(account.accountId, params.clubId)); }));
  router.post("/workspace/clubs/:clubId/access-assignments", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(clubParams, request.params); const body = parse(assignAccessSchema, request.body); const result = await workspace.assignClubAccess({ actorAccountId: account.accountId, clubId: params.clubId, accountId: body.accountId, roleCode: body.roleCode, ...(body.reason === undefined ? {} : { reason: body.reason }), ...meta(request, response) }); response.status(result.replayed ? 200 : 201).json(result); }));
  router.post("/workspace/access-assignments/:accessAssignmentId/revoke", asyncHandler(async (request, response) => { const account = await actor(request.get("authorization")); const params = parse(assignmentParams, request.params); const body = parse(revokeAccessSchema, request.body); response.status(200).json(await workspace.revokeClubAccess({ actorAccountId: account.accountId, ...params, ...body, ...meta(request, response) })); }));
  return router;
}
