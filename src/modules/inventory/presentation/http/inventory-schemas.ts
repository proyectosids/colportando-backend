import { z } from "zod";

export const idempotencyHeaders = z.object({ "idempotency-key": z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/) });
export const campaignParams = z.object({ campaignId: z.uuid() });
export const catalogParams = z.object({ catalogId: z.uuid() });
export const acquisitionParams = z.object({ acquisitionId: z.uuid() });
export const clubParams = z.object({ clubId: z.uuid() });
export const paginationQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
export const materialQuery = paginationQuery.extend({ search: z.string().trim().min(1).max(120).optional() });
const money = z.string().regex(/^\d{1,15}(\.\d{1,4})?$/);

export const createMaterialSchema = z.strictObject({ clubId: z.uuid(), code: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(500).optional(), category: z.string().trim().min(1).max(100).optional() });
export const createCatalogSchema = z.strictObject({ name: z.string().trim().min(1).max(180), sourceType: z.enum(["GEMA", "MANUAL", "IMPORT", "OTHER"]), sourceName: z.string().trim().min(1).max(180), sourceReference: z.string().trim().min(1).max(300).optional(), sourceCutAt: z.iso.datetime(), currency: z.string().regex(/^[A-Za-z]{3}$/) });
export const addCatalogItemSchema = z.strictObject({ materialId: z.uuid(), listPrice: money, bonusEligible: z.boolean().optional(), validFrom: z.iso.date().optional(), validTo: z.iso.date().optional() }).refine((value) => value.validFrom === undefined || value.validTo === undefined || value.validTo >= value.validFrom, { path: ["validTo"], message: "validTo must be on or after validFrom" });
export const catalogStatusSchema = z.strictObject({ status: z.enum(["ACTIVE", "CLOSED"]) });
export const createAcquisitionSchema = z.strictObject({ participationId: z.uuid(), catalogId: z.uuid(), externalReference: z.string().trim().min(1).max(120).optional(), acquiredAt: z.iso.datetime(), notes: z.string().trim().min(1).max(500).optional(), lines: z.array(z.strictObject({ catalogItemId: z.uuid(), quantity: z.number().int().min(1).max(100000) })).min(1).max(200) }).refine((value) => new Set(value.lines.map((line) => line.catalogItemId.toLowerCase())).size === value.lines.length, { path: ["lines"], message: "catalogItemId values must be unique" });
export const acquisitionStatusSchema = z.strictObject({ status: z.enum(["DELIVERED", "CANCELLED"]), resolution: z.string().trim().min(1).max(500).optional() }).refine((value) => value.status !== "CANCELLED" || value.resolution !== undefined, { path: ["resolution"], message: "resolution is required when cancelling" });

export const materialResponseSchema = z.object({ materialId: z.uuid(), code: z.string(), name: z.string(), status: z.literal("ACTIVE"), replayed: z.boolean() });
export const catalogResponseSchema = z.object({ catalogId: z.uuid(), campaignId: z.uuid(), name: z.string(), sourceType: z.enum(["GEMA", "MANUAL", "IMPORT", "OTHER"]), sourceName: z.string(), sourceCutAt: z.iso.datetime(), currency: z.string().length(3), status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]), replayed: z.boolean() });
export const catalogItemResponseSchema = z.object({ catalogItemId: z.uuid(), catalogId: z.uuid(), materialId: z.uuid(), code: z.string(), name: z.string(), listPrice: money, bonusEligible: z.boolean().nullable(), status: z.literal("ACTIVE"), replayed: z.boolean() });
export const acquisitionResponseSchema = z.object({ acquisitionId: z.uuid(), campaignId: z.uuid(), participationId: z.uuid(), catalogId: z.uuid(), acquiredAt: z.iso.datetime(), status: z.enum(["REGISTERED", "DELIVERED", "CANCELLED"]), currency: z.string().length(3), total: money, replayed: z.boolean() });
const catalogViewSchema = z.object({ catalog: catalogResponseSchema.omit({ replayed: true }), items: z.array(catalogItemResponseSchema.omit({ replayed: true })) });
export const catalogListResponseSchema = z.array(catalogViewSchema);
const acquisitionListItemSchema = z.object({ acquisitionId: z.uuid(), participationId: z.uuid(), acquiredAt: z.iso.datetime(), status: z.enum(["REGISTERED", "DELIVERED", "CANCELLED"]), externalReference: z.string().nullable(), currency: z.string().length(3), total: money, itemCount: z.number().int().positive() });
export const acquisitionListResponseSchema = z.object({ items: z.array(acquisitionListItemSchema), page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative() });
export const materialListResponseSchema = z.object({ items: z.array(z.object({ materialId: z.uuid(), code: z.string(), name: z.string(), category: z.string().nullable(), status: z.enum(["ACTIVE", "INACTIVE"]) })), page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative() });
