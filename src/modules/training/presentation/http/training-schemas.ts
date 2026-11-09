import { z } from "zod";

export const idempotencyHeadersSchema = z.object({ "idempotency-key": z.string().trim().min(8).max(100) });
export const createProgramSchema = z.strictObject({ clubId: z.uuid(), code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/), name: z.string().trim().min(1).max(180), versionLabel: z.string().trim().min(1).max(120), startsOn: z.iso.date().optional(), endsOn: z.iso.date().optional() }).refine((value) => value.startsOn === undefined || value.endsOn === undefined || value.endsOn >= value.startsOn, { message: "endsOn must be on or after startsOn", path: ["endsOn"] });
export const versionParamsSchema = z.object({ versionId: z.uuid() });
export const createSessionSchema = z.strictObject({ title: z.string().trim().min(1).max(180), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) });
export const createEnrollmentSchema = z.strictObject({ membershipId: z.uuid() });
export const attendanceParamsSchema = z.object({ sessionId: z.uuid(), enrollmentId: z.uuid() });
export const recordAttendanceSchema = z.strictObject({ attendanceStatus: z.enum(["PRESENT", "ABSENT", "EXCUSED"]), notes: z.string().trim().min(1).max(500).optional() });
export const sessionParamsSchema = z.object({ sessionId: z.uuid() });
export const changeSessionStatusSchema = z.strictObject({ status: z.enum(["CLOSED", "CANCELLED"]) });
export const enrollmentParamsSchema = z.object({ enrollmentId: z.uuid() });

export const programCreatedSchema = z.object({ programId: z.uuid(), programVersionId: z.uuid(), clubId: z.uuid(), code: z.string(), name: z.string(), versionNumber: z.literal(1), versionLabel: z.string(), replayed: z.boolean() });
export const sessionCreatedSchema = z.object({ sessionId: z.uuid(), programVersionId: z.uuid(), title: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), status: z.literal("OPEN"), replayed: z.boolean() });
export const enrollmentCreatedSchema = z.object({ enrollmentId: z.uuid(), programVersionId: z.uuid(), membershipId: z.uuid(), status: z.literal("ENROLLED"), replayed: z.boolean() });
export const attendanceRecordedSchema = z.object({ attendanceId: z.uuid(), sessionId: z.uuid(), enrollmentId: z.uuid(), attendanceStatus: z.enum(["PRESENT", "ABSENT", "EXCUSED"]), replayed: z.boolean() });
export const sessionStatusChangedSchema = z.object({ sessionId: z.uuid(), status: z.enum(["CLOSED", "CANCELLED"]), replayed: z.boolean() });
export const trainingProgressSchema = z.object({ enrollmentId: z.uuid(), membershipId: z.uuid(), programId: z.uuid(), programVersionId: z.uuid(), programName: z.string(), versionNumber: z.number().int().positive(), versionLabel: z.string(), enrollmentStatus: z.enum(["ENROLLED", "WITHDRAWN"]), memberCondition: z.enum(["ASPIRANT", "COLPORTOR"]), totalSessions: z.number().int().nonnegative(), recordedSessions: z.number().int().nonnegative(), presentSessions: z.number().int().nonnegative(), absentSessions: z.number().int().nonnegative(), excusedSessions: z.number().int().nonnegative(), attendanceRate: z.number().min(0).max(100).nullable(), eligibility: z.literal("NOT_EVALUATED"), promotedAutomatically: z.literal(false) });

const evidenceCodeSchema=z.string().trim().min(1).max(60).regex(/^[A-Z0-9_-]+$/);
export const promotionCriteriaSchema=z.strictObject({minimumPresentSessions:z.number().int().positive().optional(),minimumAttendanceRate:z.number().gt(0).max(100).optional(),requiredEvidenceCodes:z.array(evidenceCodeSchema).max(30).default([])}).refine((value)=>value.minimumPresentSessions!==undefined||value.minimumAttendanceRate!==undefined||value.requiredEvidenceCodes.length>0,{message:"At least one promotion criterion is required"}).refine((value)=>new Set(value.requiredEvidenceCodes).size===value.requiredEvidenceCodes.length,{message:"Evidence requirement codes must be unique",path:["requiredEvidenceCodes"]});
export const evidenceReferenceSchema=z.strictObject({code:evidenceCodeSchema,reference:z.string().trim().min(1).max(500),description:z.string().trim().min(1).max(500).optional()});
export const configureCriteriaSchema=z.strictObject({criteria:promotionCriteriaSchema});
export const transitionDecisionSchema=z.strictObject({outcome:z.enum(["APPROVED","REJECTED"]),reason:z.string().trim().min(1).max(1000),evidence:z.array(evidenceReferenceSchema).min(1).max(30)});
export const experienceRecognitionSchema=transitionDecisionSchema.extend({experienceSummary:z.string().trim().min(1).max(2000)});
export const membershipParamsSchema=z.object({membershipId:z.uuid()});
export const criteriaConfiguredSchema=z.object({programVersionId:z.uuid(),criteria:promotionCriteriaSchema,replayed:z.boolean()});
export const promotionDecisionResponseSchema=z.object({promotionDecisionId:z.uuid(),enrollmentId:z.uuid(),membershipId:z.uuid(),outcome:z.enum(["APPROVED","REJECTED"]),eligible:z.boolean(),memberCondition:z.enum(["ASPIRANT","COLPORTOR"]),replayed:z.boolean()});
export const experienceRecognitionResponseSchema=z.object({experienceRecognitionId:z.uuid(),membershipId:z.uuid(),outcome:z.enum(["APPROVED","REJECTED"]),memberCondition:z.enum(["ASPIRANT","COLPORTOR"]),replayed:z.boolean()});
export const transitionHistorySchema=z.object({membershipId:z.uuid(),memberCondition:z.enum(["ASPIRANT","COLPORTOR"]),events:z.array(z.object({conditionEventId:z.uuid(),previousCondition:z.enum(["ASPIRANT","COLPORTOR"]).nullable(),newCondition:z.enum(["ASPIRANT","COLPORTOR"]),transitionMethod:z.enum(["INITIAL_REGISTRATION","TRAINING_COMPLETION","PRIOR_EXPERIENCE_RECOGNITION","ADMIN_CORRECTION"]),reason:z.string().nullable(),evidence:z.unknown(),actorAccountId:z.uuid().nullable(),occurredAt:z.iso.datetime()}))});
