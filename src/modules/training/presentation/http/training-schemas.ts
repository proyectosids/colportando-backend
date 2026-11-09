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
