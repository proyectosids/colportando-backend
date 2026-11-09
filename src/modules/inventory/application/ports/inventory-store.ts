export type InventoryError = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_CONFLICT";
export type WriteContext = Readonly<{ actorAccountId: string; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string; now: Date }>;

export type MaterialResult = Readonly<{ materialId: string; code: string; name: string; status: "ACTIVE"; replayed: boolean }>;
export type CatalogResult = Readonly<{ catalogId: string; campaignId: string; name: string; sourceType: "GEMA" | "MANUAL" | "IMPORT" | "OTHER"; sourceName: string; sourceCutAt: string; currency: string; status: "DRAFT" | "ACTIVE" | "CLOSED"; replayed: boolean }>;
export type CatalogItemResult = Readonly<{ catalogItemId: string; catalogId: string; materialId: string; code: string; name: string; listPrice: string; bonusEligible: boolean | null; status: "ACTIVE"; replayed: boolean }>;
export type AcquisitionResult = Readonly<{ acquisitionId: string; campaignId: string; participationId: string; catalogId: string; acquiredAt: string; status: "REGISTERED" | "DELIVERED" | "CANCELLED"; currency: string; total: string; replayed: boolean }>;
export type CatalogView = Readonly<{ catalog: Omit<CatalogResult, "replayed">; items: ReadonlyArray<Omit<CatalogItemResult, "replayed">> }>;
export type AcquisitionListItem = Readonly<{ acquisitionId: string; participationId: string; acquiredAt: string; status: "REGISTERED" | "DELIVERED" | "CANCELLED"; externalReference: string | null; currency: string; total: string; itemCount: number }>;
export type MaterialListItem = Readonly<{ materialId: string; code: string; name: string; category: string | null; status: "ACTIVE" | "INACTIVE" }>;

export interface InventoryStore {
  createMaterial(input: WriteContext & Readonly<{ materialId: string; clubId: string; code: string; name: string; description?: string; category?: string }>): Promise<MaterialResult | InventoryError>;
  createCatalog(input: WriteContext & Readonly<{ catalogId: string; campaignId: string; name: string; sourceType: CatalogResult["sourceType"]; sourceName: string; sourceReference?: string; sourceCutAt: Date; currency: string }>): Promise<CatalogResult | InventoryError>;
  addCatalogItem(input: WriteContext & Readonly<{ catalogItemId: string; catalogId: string; materialId: string; listPrice: string; bonusEligible?: boolean; validFrom?: string; validTo?: string }>): Promise<CatalogItemResult | InventoryError>;
  changeCatalogStatus(input: WriteContext & Readonly<{ catalogId: string; status: "ACTIVE" | "CLOSED" }>): Promise<CatalogResult | InventoryError>;
  createAcquisition(input: WriteContext & Readonly<{ acquisitionId: string; campaignId: string; participationId: string; catalogId: string; externalReference?: string; acquiredAt: Date; notes?: string; lines: ReadonlyArray<{ acquisitionLineId: string; catalogItemId: string; quantity: number }> }>): Promise<AcquisitionResult | InventoryError>;
  changeAcquisitionStatus(input: WriteContext & Readonly<{ acquisitionId: string; status: "DELIVERED" | "CANCELLED"; resolution?: string }>): Promise<AcquisitionResult | InventoryError>;
  readMaterials(input: Readonly<{ actorAccountId: string; clubId: string; page: number; pageSize: number; search?: string }>): Promise<{ items: MaterialListItem[]; page: number; pageSize: number; total: number } | InventoryError>;
  readCampaignCatalog(input: Readonly<{ actorAccountId: string; campaignId: string }>): Promise<CatalogView[] | InventoryError>;
  readCampaignAcquisitions(input: Readonly<{ actorAccountId: string; campaignId: string; page: number; pageSize: number }>): Promise<{ items: AcquisitionListItem[]; page: number; pageSize: number; total: number } | InventoryError>;
  readMyAcquisitions(input: Readonly<{ actorAccountId: string; page: number; pageSize: number }>): Promise<{ items: AcquisitionListItem[]; page: number; pageSize: number; total: number }>;
}
