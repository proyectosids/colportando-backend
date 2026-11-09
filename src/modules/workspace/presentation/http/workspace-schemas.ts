import { z } from "zod";

export const clubParams = z.object({ clubId: z.uuid() });
export const campaignParams = z.object({ campaignId: z.uuid() });
export const assignmentParams = z.object({ accessAssignmentId: z.uuid() });
export const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().min(1).max(120).optional() });
export const idempotencyHeaders = z.object({ "idempotency-key": z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/) });
export const assignAccessSchema = z.strictObject({ accountId: z.uuid(), roleCode: z.enum(["CLUB_ADMIN", "CAMPAIGN_MANAGER", "TRAINING_COORDINATOR"]), reason: z.string().trim().min(1).max(500).optional() });
export const revokeAccessSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) });

const roleSchema = z.object({ code: z.string(), name: z.string(), scopeType: z.enum(["PLATFORM", "INSTITUTION", "CLUB"]) });
const membershipSchema = z.object({ membershipId: z.uuid(), status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ENDED"]), condition: z.enum(["ASPIRANT", "COLPORTOR"]) });
export const workspaceContextSchema = z.object({ accountId: z.uuid(), email: z.email(), clubs: z.array(z.object({ tenantId: z.uuid(), institutionId: z.uuid(), institutionName: z.string(), clubId: z.uuid(), clubName: z.string(), membership: membershipSchema.nullable(), roles: z.array(roleSchema), permissions: z.array(z.string()), associateGroupIds: z.array(z.uuid()) })) });
const pageMeta = { page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative() };
export const membershipsPageSchema = z.object({ items: z.array(z.object({ accountId: z.uuid().nullable(), membershipId: z.uuid(), personId: z.uuid(), displayName: z.string(), email: z.email().nullable(), membershipStatus: z.string(), memberCondition: z.string() })), ...pageMeta });
export const campaignsPageSchema = z.object({ items: z.array(z.object({ campaignId: z.uuid(), name: z.string(), startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.string(), participantCount: z.number().int().nonnegative(), groupCount: z.number().int().nonnegative() })), ...pageMeta });
export const groupsPageSchema = z.object({ items: z.array(z.object({ groupId: z.uuid(), name: z.string(), status: z.string(), associateParticipationId: z.uuid().nullable(), participantCount: z.number().int().nonnegative(), fieldCount: z.number().int().nonnegative() })), ...pageMeta });
export const trainingProgramsPageSchema = z.object({ items: z.array(z.object({ programId: z.uuid(), code: z.string(), name: z.string(), status: z.string(), activeVersionId: z.uuid().nullable(), activeVersionLabel: z.string().nullable() })), ...pageMeta });
export const roleListSchema = z.array(z.object({ roleId: z.uuid(), code: z.string(), name: z.string(), scopeType: z.literal("CLUB") }));
export const accessAssignmentSchema = z.object({ accessAssignmentId: z.uuid(), accountId: z.uuid(), roleCode: z.string(), clubId: z.uuid(), status: z.enum(["ACTIVE", "REVOKED"]), replayed: z.boolean() });
