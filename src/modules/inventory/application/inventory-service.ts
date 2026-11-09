import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import type { InventoryError, InventoryStore } from "./ports/inventory-store.js";

const digest = (value: unknown): Buffer => createHash("sha256").update(JSON.stringify(value)).digest();
const clean = (value: string): string => value.trim().replace(/\s+/g, " ");

export class InventoryService {
  public constructor(private readonly store: InventoryStore, private readonly now: () => Date = () => new Date()) {}

  public createMaterial(input: Readonly<{ actorAccountId: string; clubId: string; code: string; name: string; description?: string; category?: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { clubId: input.clubId.toLowerCase(), code: clean(input.code).toUpperCase(), name: clean(input.name), description: input.description === undefined ? null : clean(input.description), category: input.category === undefined ? null : clean(input.category) };
    return this.unwrap(this.store.createMaterial({ ...this.context(input, canonical), materialId: randomUUID(), clubId: input.clubId, code: canonical.code, name: canonical.name, ...(canonical.description === null ? {} : { description: canonical.description }), ...(canonical.category === null ? {} : { category: canonical.category }) }));
  }

  public createCatalog(input: Readonly<{ actorAccountId: string; campaignId: string; name: string; sourceType: "GEMA" | "MANUAL" | "IMPORT" | "OTHER"; sourceName: string; sourceReference?: string; sourceCutAt: string; currency: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { campaignId: input.campaignId.toLowerCase(), name: clean(input.name), sourceType: input.sourceType, sourceName: clean(input.sourceName), sourceReference: input.sourceReference === undefined ? null : clean(input.sourceReference), sourceCutAt: input.sourceCutAt, currency: input.currency.toUpperCase() };
    return this.unwrap(this.store.createCatalog({ ...this.context(input, canonical), catalogId: randomUUID(), campaignId: input.campaignId, name: canonical.name, sourceType: input.sourceType, sourceName: canonical.sourceName, ...(canonical.sourceReference === null ? {} : { sourceReference: canonical.sourceReference }), sourceCutAt: new Date(input.sourceCutAt), currency: canonical.currency }));
  }

  public addCatalogItem(input: Readonly<{ actorAccountId: string; catalogId: string; materialId: string; listPrice: string; bonusEligible?: boolean; validFrom?: string; validTo?: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { catalogId: input.catalogId.toLowerCase(), materialId: input.materialId.toLowerCase(), listPrice: input.listPrice, bonusEligible: input.bonusEligible ?? null, validFrom: input.validFrom ?? null, validTo: input.validTo ?? null };
    return this.unwrap(this.store.addCatalogItem({ ...this.context(input, canonical), catalogItemId: randomUUID(), catalogId: input.catalogId, materialId: input.materialId, listPrice: input.listPrice, ...(input.bonusEligible === undefined ? {} : { bonusEligible: input.bonusEligible }), ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }), ...(input.validTo === undefined ? {} : { validTo: input.validTo }) }));
  }

  public changeCatalogStatus(input: Readonly<{ actorAccountId: string; catalogId: string; status: "ACTIVE" | "CLOSED"; idempotencyKey: string; correlationId: string }>) {
    return this.unwrap(this.store.changeCatalogStatus({ ...this.context(input, { catalogId: input.catalogId.toLowerCase(), status: input.status }), catalogId: input.catalogId, status: input.status }));
  }

  public createAcquisition(input: Readonly<{ actorAccountId: string; campaignId: string; participationId: string; catalogId: string; externalReference?: string; acquiredAt: string; notes?: string; lines: ReadonlyArray<{ catalogItemId: string; quantity: number }>; idempotencyKey: string; correlationId: string }>) {
    const lines = [...input.lines].sort((a, b) => a.catalogItemId.localeCompare(b.catalogItemId));
    const canonical = { campaignId: input.campaignId.toLowerCase(), participationId: input.participationId.toLowerCase(), catalogId: input.catalogId.toLowerCase(), externalReference: input.externalReference === undefined ? null : clean(input.externalReference), acquiredAt: input.acquiredAt, notes: input.notes === undefined ? null : clean(input.notes), lines: lines.map((line) => ({ catalogItemId: line.catalogItemId.toLowerCase(), quantity: line.quantity })) };
    return this.unwrap(this.store.createAcquisition({ ...this.context(input, canonical), acquisitionId: randomUUID(), campaignId: input.campaignId, participationId: input.participationId, catalogId: input.catalogId, ...(canonical.externalReference === null ? {} : { externalReference: canonical.externalReference }), acquiredAt: new Date(input.acquiredAt), ...(canonical.notes === null ? {} : { notes: canonical.notes }), lines: lines.map((line) => ({ acquisitionLineId: randomUUID(), ...line })) }));
  }

  public changeAcquisitionStatus(input: Readonly<{ actorAccountId: string; acquisitionId: string; status: "DELIVERED" | "CANCELLED"; resolution?: string; idempotencyKey: string; correlationId: string }>) {
    const resolution = input.resolution === undefined ? undefined : clean(input.resolution);
    return this.unwrap(this.store.changeAcquisitionStatus({ ...this.context(input, { acquisitionId: input.acquisitionId.toLowerCase(), status: input.status, resolution: resolution ?? null }), acquisitionId: input.acquisitionId, status: input.status, ...(resolution === undefined ? {} : { resolution }) }));
  }

  public async getCampaignCatalog(actorAccountId: string, campaignId: string) { return this.unwrap(this.store.readCampaignCatalog({ actorAccountId, campaignId })); }
  public async getMaterials(actorAccountId: string, clubId: string, page: number, pageSize: number, search?: string) { return this.unwrap(this.store.readMaterials({ actorAccountId, clubId, page, pageSize, ...(search === undefined ? {} : { search: clean(search) }) })); }
  public async getCampaignAcquisitions(actorAccountId: string, campaignId: string, page: number, pageSize: number) { return this.unwrap(this.store.readCampaignAcquisitions({ actorAccountId, campaignId, page, pageSize })); }
  public getMyAcquisitions(actorAccountId: string, page: number, pageSize: number) { return this.store.readMyAcquisitions({ actorAccountId, page, pageSize }); }

  private context(input: Readonly<{ actorAccountId: string; idempotencyKey: string; correlationId: string }>, canonical: unknown) {
    return { actorAccountId: input.actorAccountId, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId, requestHash: digest(canonical), subjectHash: digest({ actor: input.actorAccountId.toLowerCase() }), now: this.now() };
  }

  private async unwrap<T>(promise: Promise<T | InventoryError>): Promise<T> {
    const result = await promise;
    if (typeof result !== "string") return result;
    const errors: Record<InventoryError, readonly [number, string, string]> = {
      FORBIDDEN: [403, "INVENTORY_FORBIDDEN", "Account lacks the required scope or permission"],
      NOT_FOUND: [404, "INVENTORY_NOT_FOUND", "Inventory resource was not found"],
      CONFLICT: [409, "INVENTORY_CONFLICT", "Inventory resource conflicts with its current state"],
      IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request"]
    };
    const [status, code, message] = errors[result as InventoryError];
    throw new AppError(status, code, message);
  }
}
