import { Router, type RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";

import type { AuthService } from "../../../auth/application/auth-service.js";
import type { TrainingService } from "../../application/training-service.js";
import type { MemberTransitionService } from "../../application/member-transition-service.js";
import { AppError } from "../../../../shared/presentation/http/errors/app-error.js";
import { attendanceParamsSchema, changeSessionStatusSchema, configureCriteriaSchema, createEnrollmentSchema, createProgramSchema, createSessionSchema, enrollmentParamsSchema, experienceRecognitionSchema, idempotencyHeadersSchema, membershipParamsSchema, recordAttendanceSchema, sessionParamsSchema, transitionDecisionSchema, versionParamsSchema } from "./training-schemas.js";

const parse = <T>(schema: ZodType<T>, value: unknown): T => { try { return schema.parse(value); } catch (error) { if (error instanceof ZodError) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", error.issues); throw error; } };
const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => { Promise.resolve(handler(request, response, next)).catch(next); };

export function createTrainingRouter(auth: AuthService, training: TrainingService, transitions?:MemberTransitionService): Router {
  const router = Router();
  const actor = async (authorization: string | undefined) => {
    if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid");
    return auth.authenticateAccessToken(authorization.slice(7));
  };
  const idempotencyKey = (value: string | undefined): string => parse(idempotencyHeadersSchema, { "idempotency-key": value })["idempotency-key"];
  const evidence=(items:readonly {code:string;reference:string;description?:string|undefined}[])=>items.map((item)=>({code:item.code,reference:item.reference,...(item.description===undefined?{}:{description:item.description})}));

  router.post("/training/programs", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const body = parse(createProgramSchema, request.body);
    const result = await training.createProgram({ actorAccountId: account.accountId, clubId: body.clubId, code: body.code, name: body.name, versionLabel: body.versionLabel, ...(body.startsOn === undefined ? {} : { startsOn: body.startsOn }), ...(body.endsOn === undefined ? {} : { endsOn: body.endsOn }), idempotencyKey: idempotencyKey(request.get("idempotency-key")), correlationId: response.locals.correlationId as string });
    response.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/training/program-versions/:versionId/sessions", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const { versionId } = parse(versionParamsSchema, request.params); const body = parse(createSessionSchema, request.body);
    const result = await training.createSession({ actorAccountId: account.accountId, programVersionId: versionId, title: body.title, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt), idempotencyKey: idempotencyKey(request.get("idempotency-key")), correlationId: response.locals.correlationId as string });
    response.status(result.replayed ? 200 : 201).json({ ...result, startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString() });
  }));
  router.post("/training/program-versions/:versionId/enrollments", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const { versionId } = parse(versionParamsSchema, request.params); const body = parse(createEnrollmentSchema, request.body);
    const result = await training.enroll({ actorAccountId: account.accountId, programVersionId: versionId, membershipId: body.membershipId, idempotencyKey: idempotencyKey(request.get("idempotency-key")), correlationId: response.locals.correlationId as string });
    response.status(result.replayed ? 200 : 201).json(result);
  }));
  router.put("/training/sessions/:sessionId/status", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const { sessionId } = parse(sessionParamsSchema, request.params); const body = parse(changeSessionStatusSchema, request.body);
    const result = await training.changeSessionStatus({ actorAccountId: account.accountId, sessionId, status: body.status, idempotencyKey: idempotencyKey(request.get("idempotency-key")), correlationId: response.locals.correlationId as string });
    response.status(200).json(result);
  }));
  router.put("/training/sessions/:sessionId/attendance/:enrollmentId", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const params = parse(attendanceParamsSchema, request.params); const body = parse(recordAttendanceSchema, request.body);
    const result = await training.recordAttendance({ actorAccountId: account.accountId, ...params, attendanceStatus: body.attendanceStatus, ...(body.notes === undefined ? {} : { notes: body.notes }), idempotencyKey: idempotencyKey(request.get("idempotency-key")), correlationId: response.locals.correlationId as string });
    response.status(result.replayed ? 200 : 201).json(result);
  }));
  router.get("/training/enrollments/:enrollmentId/progress", asyncHandler(async (request, response) => {
    const account = await actor(request.get("authorization")); const { enrollmentId } = parse(enrollmentParamsSchema, request.params);
    response.status(200).json(await training.getProgress(account.accountId, enrollmentId));
  }));
  if(transitions!==undefined){
    router.put("/training/program-versions/:versionId/promotion-criteria",asyncHandler(async(request,response)=>{
      const account=await actor(request.get("authorization")); const {versionId}=parse(versionParamsSchema,request.params); const body=parse(configureCriteriaSchema,request.body);
      const criteria={requiredEvidenceCodes:body.criteria.requiredEvidenceCodes,...(body.criteria.minimumPresentSessions===undefined?{}:{minimumPresentSessions:body.criteria.minimumPresentSessions}),...(body.criteria.minimumAttendanceRate===undefined?{}:{minimumAttendanceRate:body.criteria.minimumAttendanceRate})};
      const result=await transitions.configureCriteria({actorAccountId:account.accountId,programVersionId:versionId,criteria,idempotencyKey:idempotencyKey(request.get("idempotency-key")),correlationId:response.locals.correlationId as string}); response.status(200).json(result);
    }));
    router.post("/training/enrollments/:enrollmentId/promotion-decisions",asyncHandler(async(request,response)=>{
      const account=await actor(request.get("authorization")); const {enrollmentId}=parse(enrollmentParamsSchema,request.params); const body=parse(transitionDecisionSchema,request.body);
      const result=await transitions.decidePromotion({actorAccountId:account.accountId,enrollmentId,outcome:body.outcome,reason:body.reason,evidence:evidence(body.evidence),idempotencyKey:idempotencyKey(request.get("idempotency-key")),correlationId:response.locals.correlationId as string}); response.status(result.replayed?200:201).json(result);
    }));
    router.post("/training/memberships/:membershipId/experience-recognitions",asyncHandler(async(request,response)=>{
      const account=await actor(request.get("authorization")); const {membershipId}=parse(membershipParamsSchema,request.params); const body=parse(experienceRecognitionSchema,request.body);
      const result=await transitions.decideExperienceRecognition({actorAccountId:account.accountId,membershipId,outcome:body.outcome,reason:body.reason,experienceSummary:body.experienceSummary,evidence:evidence(body.evidence),idempotencyKey:idempotencyKey(request.get("idempotency-key")),correlationId:response.locals.correlationId as string}); response.status(result.replayed?200:201).json(result);
    }));
    router.get("/training/memberships/:membershipId/transition-history",asyncHandler(async(request,response)=>{
      const account=await actor(request.get("authorization")); const {membershipId}=parse(membershipParamsSchema,request.params); response.status(200).json(await transitions.getHistory(account.accountId,membershipId));
    }));
  }
  return router;
}
