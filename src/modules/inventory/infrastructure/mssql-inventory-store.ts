import { randomUUID } from "node:crypto";
import sql from "mssql";

import type { AcquisitionListItem, AcquisitionResult, CatalogItemResult, CatalogResult, CatalogView, InventoryError, InventoryStore, MaterialListItem, MaterialResult, WriteContext } from "../application/ports/inventory-store.js";

type Scope = Readonly<{ tenantId: string; clubId: string }>;
type Replay = Readonly<{ requestHash: Buffer; responseJson: string }>;

export class MssqlInventoryStore implements InventoryStore {
  public constructor(private readonly pool: sql.ConnectionPool) {}

  public createMaterial(input: Parameters<InventoryStore["createMaterial"]>[0]): Promise<MaterialResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const scope = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("club", input.clubId).query<Scope>(`
        SELECT c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_organization].club c
        WHERE c.club_id=@club AND c.status='ACTIVE' AND EXISTS(${this.permission("inventory.catalog.manage", "c.tenant_id", "c.club_id")});`)).recordset[0];
      if (scope === undefined) return "FORBIDDEN";
      const replay = await this.replay<MaterialResult>(transaction, scope.tenantId, input, "CREATE_MATERIAL");
      if (replay !== null) return replay;
      const duplicate = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("code", input.code).query(`SELECT 1 FROM [C_inventory].material WHERE tenant_id=@tenant AND code=@code;`)).recordset.length > 0;
      if (duplicate) return "CONFLICT";
      await new sql.Request(transaction).input("id", input.materialId).input("tenant", scope.tenantId).input("code", input.code).input("name", input.name).input("description", input.description ?? null).input("category", input.category ?? null).input("actor", input.actorAccountId).input("now", input.now).query(`
        INSERT INTO [C_inventory].material(material_id,tenant_id,code,name,description,category,status,created_by_account_id,created_at_utc)
        VALUES(@id,@tenant,@code,@name,@description,@category,'ACTIVE',@actor,@now);`);
      const result: MaterialResult = { materialId: input.materialId, code: input.code, name: input.name, status: "ACTIVE", replayed: false };
      await this.finish(transaction, scope.tenantId, input, "CREATE_MATERIAL", "MATERIAL", input.materialId, result);
      return result;
    });
  }

  public createCatalog(input: Parameters<InventoryStore["createCatalog"]>[0]): Promise<CatalogResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const scope = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("campaign", input.campaignId).query<Scope>(`
        SELECT c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_operations].campaign c
        WHERE c.campaign_id=@campaign AND c.status IN('PLANNED','ACTIVE') AND EXISTS(${this.permission("inventory.catalog.manage", "c.tenant_id", "c.club_id")});`)).recordset[0];
      if (scope === undefined) return "FORBIDDEN";
      const replay = await this.replay<CatalogResult>(transaction, scope.tenantId, input, "CREATE_CAMPAIGN_CATALOG");
      if (replay !== null) return replay;
      const duplicate = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("campaign", input.campaignId).input("name", input.name).query(`SELECT 1 FROM [C_inventory].campaign_catalog WHERE tenant_id=@tenant AND campaign_id=@campaign AND name=@name;`)).recordset.length > 0;
      if (duplicate) return "CONFLICT";
      await new sql.Request(transaction).input("id", input.catalogId).input("tenant", scope.tenantId).input("club", scope.clubId).input("campaign", input.campaignId).input("name", input.name).input("sourceType", input.sourceType).input("sourceName", input.sourceName).input("sourceReference", input.sourceReference ?? null).input("sourceCut", input.sourceCutAt).input("currency", input.currency).input("actor", input.actorAccountId).input("now", input.now).query(`
        INSERT INTO [C_inventory].campaign_catalog(catalog_id,tenant_id,club_id,campaign_id,name,source_type,source_name,source_reference,source_cut_at_utc,currency,status,created_by_account_id,created_at_utc)
        VALUES(@id,@tenant,@club,@campaign,@name,@sourceType,@sourceName,@sourceReference,@sourceCut,@currency,'DRAFT',@actor,@now);`);
      const result: CatalogResult = { catalogId: input.catalogId, campaignId: input.campaignId, name: input.name, sourceType: input.sourceType, sourceName: input.sourceName, sourceCutAt: input.sourceCutAt.toISOString(), currency: input.currency, status: "DRAFT", replayed: false };
      await this.finish(transaction, scope.tenantId, input, "CREATE_CAMPAIGN_CATALOG", "CAMPAIGN_CATALOG", input.catalogId, result);
      return result;
    });
  }

  public addCatalogItem(input: Parameters<InventoryStore["addCatalogItem"]>[0]): Promise<CatalogItemResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const scope = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("catalog", input.catalogId).query<Scope>(`
        SELECT c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_inventory].campaign_catalog c WITH(UPDLOCK,HOLDLOCK)
        WHERE c.catalog_id=@catalog AND c.status='DRAFT' AND EXISTS(${this.permission("inventory.catalog.manage", "c.tenant_id", "c.club_id")});`)).recordset[0];
      if (scope === undefined) return "FORBIDDEN";
      const replay = await this.replay<CatalogItemResult>(transaction, scope.tenantId, input, "ADD_CATALOG_ITEM");
      if (replay !== null) return replay;
      const material = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("material", input.materialId).query<{ code: string; name: string }>(`SELECT code,name FROM [C_inventory].material WHERE tenant_id=@tenant AND material_id=@material AND status='ACTIVE';`)).recordset[0];
      if (material === undefined) return "NOT_FOUND";
      const duplicate = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("catalog", input.catalogId).input("material", input.materialId).query(`SELECT 1 FROM [C_inventory].catalog_item WHERE tenant_id=@tenant AND catalog_id=@catalog AND material_id=@material;`)).recordset.length > 0;
      if (duplicate) return "CONFLICT";
      await new sql.Request(transaction).input("id", input.catalogItemId).input("tenant", scope.tenantId).input("catalog", input.catalogId).input("material", input.materialId).input("price", sql.Decimal(19, 4), input.listPrice).input("bonus", input.bonusEligible ?? null).input("validFrom", sql.Date, input.validFrom ?? null).input("validTo", sql.Date, input.validTo ?? null).query(`
        INSERT INTO [C_inventory].catalog_item(catalog_item_id,tenant_id,catalog_id,material_id,list_price,bonus_eligible,valid_from,valid_to,status)
        VALUES(@id,@tenant,@catalog,@material,@price,@bonus,@validFrom,@validTo,'ACTIVE');`);
      const result: CatalogItemResult = { catalogItemId: input.catalogItemId, catalogId: input.catalogId, materialId: input.materialId, code: material.code, name: material.name, listPrice: input.listPrice, bonusEligible: input.bonusEligible ?? null, status: "ACTIVE", replayed: false };
      await this.finish(transaction, scope.tenantId, input, "ADD_CATALOG_ITEM", "CATALOG_ITEM", input.catalogItemId, result);
      return result;
    });
  }

  public changeCatalogStatus(input: Parameters<InventoryStore["changeCatalogStatus"]>[0]): Promise<CatalogResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const catalog = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("catalog", input.catalogId).query<Scope & { campaignId: string; name: string; sourceType: CatalogResult["sourceType"]; sourceName: string; sourceCutAt: Date; currency: string; status: CatalogResult["status"] }>(`
        SELECT c.tenant_id AS tenantId,c.club_id AS clubId,c.campaign_id AS campaignId,c.name,c.source_type AS sourceType,c.source_name AS sourceName,c.source_cut_at_utc AS sourceCutAt,c.currency,c.status
        FROM [C_inventory].campaign_catalog c WITH(UPDLOCK,HOLDLOCK) WHERE c.catalog_id=@catalog AND EXISTS(${this.permission("inventory.catalog.manage", "c.tenant_id", "c.club_id")});`)).recordset[0];
      if (catalog === undefined) return "FORBIDDEN";
      const replay = await this.replay<CatalogResult>(transaction, catalog.tenantId, input, "CHANGE_CATALOG_STATUS");
      if (replay !== null) return replay;
      const valid = (catalog.status === "DRAFT" && input.status === "ACTIVE") || (catalog.status === "ACTIVE" && input.status === "CLOSED");
      if (!valid) return "CONFLICT";
      if (input.status === "ACTIVE") {
        const hasItems = (await new sql.Request(transaction).input("tenant", catalog.tenantId).input("catalog", input.catalogId).query(`SELECT 1 FROM [C_inventory].catalog_item WHERE tenant_id=@tenant AND catalog_id=@catalog AND status='ACTIVE';`)).recordset.length > 0;
        if (!hasItems) return "CONFLICT";
      }
      await new sql.Request(transaction).input("catalog", input.catalogId).input("status", input.status).input("now", input.now).query(`UPDATE [C_inventory].campaign_catalog SET status=@status,published_at_utc=CASE WHEN @status='ACTIVE' THEN @now ELSE published_at_utc END,closed_at_utc=CASE WHEN @status='CLOSED' THEN @now ELSE NULL END WHERE catalog_id=@catalog;`);
      const result: CatalogResult = { catalogId: input.catalogId, campaignId: catalog.campaignId, name: catalog.name, sourceType: catalog.sourceType, sourceName: catalog.sourceName, sourceCutAt: catalog.sourceCutAt.toISOString(), currency: catalog.currency, status: input.status, replayed: false };
      await this.finish(transaction, catalog.tenantId, input, "CHANGE_CATALOG_STATUS", "CAMPAIGN_CATALOG", input.catalogId, result);
      return result;
    });
  }

  public createAcquisition(input: Parameters<InventoryStore["createAcquisition"]>[0]): Promise<AcquisitionResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const scope = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("campaign", input.campaignId).input("participation", input.participationId).input("catalog", input.catalogId).query<Scope & { currency: string }>(`
        SELECT c.tenant_id AS tenantId,c.club_id AS clubId,ca.currency FROM [C_operations].campaign c
        JOIN [C_operations].campaign_participation p ON p.tenant_id=c.tenant_id AND p.campaign_id=c.campaign_id AND p.participation_id=@participation AND p.status='ACTIVE'
        JOIN [C_inventory].campaign_catalog ca ON ca.tenant_id=c.tenant_id AND ca.campaign_id=c.campaign_id AND ca.catalog_id=@catalog AND ca.status='ACTIVE'
        WHERE c.campaign_id=@campaign AND c.status='ACTIVE' AND EXISTS(${this.permission("inventory.acquisition.manage", "c.tenant_id", "c.club_id")});`)).recordset[0];
      if (scope === undefined) return "FORBIDDEN";
      const replay = await this.replay<AcquisitionResult>(transaction, scope.tenantId, input, "CREATE_ACQUISITION");
      if (replay !== null) return replay;
      if (input.externalReference !== undefined) {
        const duplicate = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("campaign", input.campaignId).input("reference", input.externalReference).query(`SELECT 1 FROM [C_inventory].acquisition WHERE tenant_id=@tenant AND campaign_id=@campaign AND external_reference=@reference;`)).recordset.length > 0;
        if (duplicate) return "CONFLICT";
      }
      await new sql.Request(transaction).input("id", input.acquisitionId).input("tenant", scope.tenantId).input("club", scope.clubId).input("campaign", input.campaignId).input("participation", input.participationId).input("catalog", input.catalogId).input("reference", input.externalReference ?? null).input("acquired", input.acquiredAt).input("notes", input.notes ?? null).input("actor", input.actorAccountId).input("now", input.now).query(`
        INSERT INTO [C_inventory].acquisition(acquisition_id,tenant_id,club_id,campaign_id,participation_id,catalog_id,external_reference,acquired_at_utc,status,notes,created_by_account_id,created_at_utc)
        VALUES(@id,@tenant,@club,@campaign,@participation,@catalog,@reference,@acquired,'REGISTERED',@notes,@actor,@now);`);
      for (const line of input.lines) {
        const item = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("catalog", input.catalogId).input("item", line.catalogItemId).input("acquired", input.acquiredAt).query<{ materialId: string; listPrice: number; bonusEligible: boolean | null; code: string; name: string; sourceName: string; sourceCutAt: Date }>(`
          SELECT ci.material_id AS materialId,ci.list_price AS listPrice,ci.bonus_eligible AS bonusEligible,m.code,m.name,c.source_name AS sourceName,c.source_cut_at_utc AS sourceCutAt
          FROM [C_inventory].catalog_item ci JOIN [C_inventory].material m ON m.tenant_id=ci.tenant_id AND m.material_id=ci.material_id
          JOIN [C_inventory].campaign_catalog c ON c.tenant_id=ci.tenant_id AND c.catalog_id=ci.catalog_id
          WHERE ci.tenant_id=@tenant AND ci.catalog_id=@catalog AND ci.catalog_item_id=@item AND ci.status='ACTIVE' AND (ci.valid_from IS NULL OR ci.valid_from<=CONVERT(date,@acquired)) AND (ci.valid_to IS NULL OR ci.valid_to>=CONVERT(date,@acquired));`)).recordset[0];
        if (item === undefined) return "CONFLICT";
        await new sql.Request(transaction).input("id", line.acquisitionLineId).input("tenant", scope.tenantId).input("acquisition", input.acquisitionId).input("item", line.catalogItemId).input("material", item.materialId).input("quantity", line.quantity).input("price", sql.Decimal(19, 4), item.listPrice).input("currency", scope.currency).input("code", item.code).input("name", item.name).input("source", item.sourceName).input("cut", item.sourceCutAt).input("bonus", item.bonusEligible).query(`
          INSERT INTO [C_inventory].acquisition_line(acquisition_line_id,tenant_id,acquisition_id,catalog_item_id,material_id,quantity,unit_price_snapshot,currency_snapshot,material_code_snapshot,material_name_snapshot,source_name_snapshot,source_cut_at_utc_snapshot,bonus_eligible_snapshot)
          VALUES(@id,@tenant,@acquisition,@item,@material,@quantity,@price,@currency,@code,@name,@source,@cut,@bonus);`);
      }
      const total = (await new sql.Request(transaction).input("tenant", scope.tenantId).input("id", input.acquisitionId).query<{ total: string }>(`SELECT CONVERT(varchar(50),CAST(SUM(quantity*unit_price_snapshot) AS decimal(19,4))) AS total FROM [C_inventory].acquisition_line WHERE tenant_id=@tenant AND acquisition_id=@id;`)).recordset[0]?.total ?? "0.0000";
      const result: AcquisitionResult = { acquisitionId: input.acquisitionId, campaignId: input.campaignId, participationId: input.participationId, catalogId: input.catalogId, acquiredAt: input.acquiredAt.toISOString(), status: "REGISTERED", currency: scope.currency, total, replayed: false };
      await this.finish(transaction, scope.tenantId, input, "CREATE_ACQUISITION", "ACQUISITION", input.acquisitionId, result);
      return result;
    });
  }

  public changeAcquisitionStatus(input: Parameters<InventoryStore["changeAcquisitionStatus"]>[0]): Promise<AcquisitionResult | InventoryError> {
    return this.transaction(async (transaction) => {
      const acquisition = (await new sql.Request(transaction).input("actor", input.actorAccountId).input("id", input.acquisitionId).query<Scope & { campaignId: string; participationId: string; catalogId: string; acquiredAt: Date; status: string; currency: string; total: string }>(`
        SELECT a.tenant_id AS tenantId,a.club_id AS clubId,a.campaign_id AS campaignId,a.participation_id AS participationId,a.catalog_id AS catalogId,a.acquired_at_utc AS acquiredAt,a.status,
        MIN(l.currency_snapshot) AS currency,CONVERT(varchar(50),CAST(SUM(l.quantity*l.unit_price_snapshot) AS decimal(19,4))) AS total
        FROM [C_inventory].acquisition a WITH(UPDLOCK,HOLDLOCK) JOIN [C_inventory].acquisition_line l ON l.tenant_id=a.tenant_id AND l.acquisition_id=a.acquisition_id
        WHERE a.acquisition_id=@id AND EXISTS(${this.permission("inventory.acquisition.manage", "a.tenant_id", "a.club_id")})
        GROUP BY a.tenant_id,a.club_id,a.campaign_id,a.participation_id,a.catalog_id,a.acquired_at_utc,a.status;`)).recordset[0];
      if (acquisition === undefined) return "FORBIDDEN";
      const replay = await this.replay<AcquisitionResult>(transaction, acquisition.tenantId, input, "CHANGE_ACQUISITION_STATUS");
      if (replay !== null) return replay;
      if (acquisition.status !== "REGISTERED" || (input.status === "CANCELLED" && input.resolution === undefined)) return "CONFLICT";
      await new sql.Request(transaction).input("id", input.acquisitionId).input("status", input.status).input("resolution", input.resolution ?? null).input("now", input.now).query(`
        UPDATE [C_inventory].acquisition SET status=@status,resolution=@resolution,delivered_at_utc=CASE WHEN @status='DELIVERED' THEN @now ELSE NULL END,cancelled_at_utc=CASE WHEN @status='CANCELLED' THEN @now ELSE NULL END WHERE acquisition_id=@id;`);
      const result: AcquisitionResult = { acquisitionId: input.acquisitionId, campaignId: acquisition.campaignId, participationId: acquisition.participationId, catalogId: acquisition.catalogId, acquiredAt: acquisition.acquiredAt.toISOString(), status: input.status, currency: acquisition.currency, total: acquisition.total, replayed: false };
      await this.finish(transaction, acquisition.tenantId, input, "CHANGE_ACQUISITION_STATUS", "ACQUISITION", input.acquisitionId, result);
      return result;
    });
  }

  public async readMaterials(input: Parameters<InventoryStore["readMaterials"]>[0]) {
    const scope = (await this.pool.request().input("actor", input.actorAccountId).input("club", input.clubId).query<Scope>(`
      SELECT c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_organization].club c WHERE c.club_id=@club AND EXISTS(${this.permission("inventory.catalog.read", "c.tenant_id", "c.club_id")});`)).recordset[0];
    if (scope === undefined) return "FORBIDDEN" as const;
    const offset = (input.page - 1) * input.pageSize;
    const rows = (await this.pool.request().input("tenant", scope.tenantId).input("offset", offset).input("size", input.pageSize).input("search", input.search === undefined ? null : `%${input.search}%`).query<MaterialListItem & { totalRows: number }>(`
      SELECT material_id AS materialId,code,name,category,status,COUNT(*) OVER() AS totalRows FROM [C_inventory].material WHERE tenant_id=@tenant AND (@search IS NULL OR code LIKE @search OR name LIKE @search OR category LIKE @search) ORDER BY name OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;`)).recordset;
    return { items: rows.map(({ totalRows, ...row }) => { void totalRows; return row; }), page: input.page, pageSize: input.pageSize, total: rows[0]?.totalRows ?? 0 };
  }

  public async readCampaignCatalog(input: Parameters<InventoryStore["readCampaignCatalog"]>[0]): Promise<CatalogView[] | InventoryError> {
    const scope = (await this.pool.request().input("actor", input.actorAccountId).input("campaign", input.campaignId).query<Scope>(`
      SELECT c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_operations].campaign c WHERE c.campaign_id=@campaign AND (
      EXISTS(${this.permission("inventory.catalog.read", "c.tenant_id", "c.club_id")}) OR EXISTS(${this.selfParticipation("c.tenant_id", "c.campaign_id")}) OR EXISTS(${this.associateCampaign("c.tenant_id", "c.campaign_id")}));`)).recordset[0];
    if (scope === undefined) return "FORBIDDEN";
    const catalogs = (await this.pool.request().input("actor", input.actorAccountId).input("tenant", scope.tenantId).input("campaign", input.campaignId).query<{ catalogId: string; campaignId: string; name: string; sourceType: CatalogResult["sourceType"]; sourceName: string; sourceCutAt: Date; currency: string; status: CatalogResult["status"] }>(`
      SELECT c.catalog_id AS catalogId,c.campaign_id AS campaignId,c.name,c.source_type AS sourceType,c.source_name AS sourceName,c.source_cut_at_utc AS sourceCutAt,c.currency,c.status FROM [C_inventory].campaign_catalog c WHERE c.tenant_id=@tenant AND c.campaign_id=@campaign AND (c.status='ACTIVE' OR EXISTS(${this.permission("inventory.catalog.manage", "c.tenant_id", "c.club_id")})) ORDER BY c.source_cut_at_utc DESC;`)).recordset;
    const result: CatalogView[] = [];
    for (const catalog of catalogs) {
      const items = (await this.pool.request().input("tenant", scope.tenantId).input("catalog", catalog.catalogId).query<{ catalogItemId: string; catalogId: string; materialId: string; code: string; name: string; listPrice: string; bonusEligible: boolean | null; status: "ACTIVE" }>(`
        SELECT ci.catalog_item_id AS catalogItemId,ci.catalog_id AS catalogId,ci.material_id AS materialId,m.code,m.name,CONVERT(varchar(50),ci.list_price) AS listPrice,ci.bonus_eligible AS bonusEligible,ci.status FROM [C_inventory].catalog_item ci JOIN [C_inventory].material m ON m.tenant_id=ci.tenant_id AND m.material_id=ci.material_id WHERE ci.tenant_id=@tenant AND ci.catalog_id=@catalog AND ci.status='ACTIVE' ORDER BY m.name;`)).recordset;
      result.push({ catalog: { ...catalog, sourceCutAt: catalog.sourceCutAt.toISOString() }, items });
    }
    return result;
  }

  public async readCampaignAcquisitions(input: Parameters<InventoryStore["readCampaignAcquisitions"]>[0]) {
    const rows = await this.readAcquisitions(input.actorAccountId, `a.campaign_id=@campaign AND`, input.page, input.pageSize, (request) => request.input("campaign", input.campaignId));
    if (rows === null) return "FORBIDDEN" as const;
    return rows;
  }

  public async readMyAcquisitions(input: Parameters<InventoryStore["readMyAcquisitions"]>[0]) {
    const offset = (input.page - 1) * input.pageSize;
    const rows = (await this.pool.request().input("actor", input.actorAccountId).input("offset", offset).input("pageSize", input.pageSize).query<AcquisitionListItem & { totalRows: number }>(`
      SELECT a.acquisition_id AS acquisitionId,a.participation_id AS participationId,CONVERT(varchar(33),a.acquired_at_utc,127)+'Z' AS acquiredAt,a.status,a.external_reference AS externalReference,
      MIN(l.currency_snapshot) AS currency,CONVERT(varchar(50),CAST(SUM(l.quantity*l.unit_price_snapshot) AS decimal(19,4))) AS total,COUNT(l.acquisition_line_id) AS itemCount,COUNT(*) OVER() AS totalRows
      FROM [C_inventory].acquisition a JOIN [C_inventory].acquisition_line l ON l.tenant_id=a.tenant_id AND l.acquisition_id=a.acquisition_id
      JOIN [C_operations].campaign_participation p ON p.tenant_id=a.tenant_id AND p.participation_id=a.participation_id
      WHERE EXISTS(SELECT 1 FROM [C_membership].club_membership m JOIN [C_identity].account_person_link apl ON apl.tenant_id=m.tenant_id AND apl.person_id=m.person_id AND apl.status='ACTIVE' WHERE m.membership_id=p.membership_id AND apl.account_id=@actor)
      GROUP BY a.acquisition_id,a.participation_id,a.acquired_at_utc,a.status,a.external_reference ORDER BY a.acquired_at_utc DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;`)).recordset;
    return { items: rows.map(({ totalRows, ...row }) => { void totalRows; return row; }), page: input.page, pageSize: input.pageSize, total: rows[0]?.totalRows ?? 0 };
  }

  private async readAcquisitions(actorAccountId: string, prefix: string, page: number, pageSize: number, bind: (request: sql.Request) => sql.Request) {
    const offset = (page - 1) * pageSize;
    const request = bind(this.pool.request().input("actor", actorAccountId).input("offset", offset).input("pageSize", pageSize));
    const rows = (await request.query<AcquisitionListItem & { totalRows: number }>(`
      SELECT a.acquisition_id AS acquisitionId,a.participation_id AS participationId,CONVERT(varchar(33),a.acquired_at_utc,127)+'Z' AS acquiredAt,a.status,a.external_reference AS externalReference,
      MIN(l.currency_snapshot) AS currency,CONVERT(varchar(50),CAST(SUM(l.quantity*l.unit_price_snapshot) AS decimal(19,4))) AS total,COUNT(l.acquisition_line_id) AS itemCount,COUNT(*) OVER() AS totalRows
      FROM [C_inventory].acquisition a JOIN [C_inventory].acquisition_line l ON l.tenant_id=a.tenant_id AND l.acquisition_id=a.acquisition_id
      JOIN [C_operations].campaign_participation p ON p.tenant_id=a.tenant_id AND p.participation_id=a.participation_id
      WHERE ${prefix}(
        EXISTS(${this.permission("inventory.acquisition.read", "a.tenant_id", "a.club_id")})
        OR EXISTS(SELECT 1 FROM [C_membership].club_membership m JOIN [C_identity].account_person_link apl ON apl.tenant_id=m.tenant_id AND apl.person_id=m.person_id AND apl.status='ACTIVE' WHERE m.membership_id=p.membership_id AND apl.account_id=@actor)
        OR EXISTS(SELECT 1 FROM [C_operations].group_assignment ga JOIN [C_operations].associate_assignment aa ON aa.tenant_id=ga.tenant_id AND aa.group_id=ga.group_id AND aa.status='ACTIVE' JOIN [C_operations].campaign_participation ap ON ap.tenant_id=aa.tenant_id AND ap.participation_id=aa.participation_id JOIN [C_membership].club_membership am ON am.tenant_id=ap.tenant_id AND am.membership_id=ap.membership_id JOIN [C_identity].account_person_link al ON al.tenant_id=am.tenant_id AND al.person_id=am.person_id AND al.account_id=@actor AND al.status='ACTIVE' WHERE ga.tenant_id=a.tenant_id AND ga.participation_id=a.participation_id AND ga.ends_at_utc IS NULL)
      ) GROUP BY a.acquisition_id,a.participation_id,a.acquired_at_utc,a.status,a.external_reference ORDER BY a.acquired_at_utc DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;`)).recordset;
    if (prefix !== "" && rows.length === 0) {
      const existsRequest = bind(this.pool.request().input("actor", actorAccountId));
      const authorized = (await existsRequest.query(`SELECT 1 FROM [C_operations].campaign c WHERE c.campaign_id=@campaign AND (EXISTS(${this.permission("inventory.acquisition.read", "c.tenant_id", "c.club_id")}) OR EXISTS(${this.selfParticipation("c.tenant_id", "c.campaign_id")}) OR EXISTS(${this.associateCampaign("c.tenant_id", "c.campaign_id")}));`)).recordset.length > 0;
      if (!authorized) return null;
    }
    return { items: rows.map(({ totalRows, ...row }) => { void totalRows; return row; }), page, pageSize, total: rows[0]?.totalRows ?? 0 };
  }

  private permission(code: string, tenant: string, club: string): string {
    return `SELECT 1 FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission pe ON pe.permission_id=rp.permission_id AND pe.code='${code}' AND pe.status='ACTIVE' WHERE aa.account_id=@actor AND aa.status='ACTIVE' AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND (aa.scope_type='PLATFORM' OR (aa.scope_type='INSTITUTION' AND aa.tenant_id=${tenant}) OR (aa.scope_type='CLUB' AND aa.tenant_id=${tenant} AND aa.club_id=${club}))`;
  }

  private selfParticipation(tenant: string, campaign: string): string {
    return `SELECT 1 FROM [C_operations].campaign_participation sp JOIN [C_membership].club_membership sm ON sm.tenant_id=sp.tenant_id AND sm.membership_id=sp.membership_id JOIN [C_identity].account_person_link sl ON sl.tenant_id=sm.tenant_id AND sl.person_id=sm.person_id AND sl.account_id=@actor AND sl.status='ACTIVE' WHERE sp.tenant_id=${tenant} AND sp.campaign_id=${campaign} AND sp.status='ACTIVE'`;
  }

  private associateCampaign(tenant: string, campaign: string): string {
    return `SELECT 1 FROM [C_operations].associate_assignment sa JOIN [C_operations].campaign_participation sap ON sap.tenant_id=sa.tenant_id AND sap.participation_id=sa.participation_id JOIN [C_membership].club_membership sam ON sam.tenant_id=sap.tenant_id AND sam.membership_id=sap.membership_id JOIN [C_identity].account_person_link sal ON sal.tenant_id=sam.tenant_id AND sal.person_id=sam.person_id AND sal.account_id=@actor AND sal.status='ACTIVE' WHERE sa.tenant_id=${tenant} AND sa.campaign_id=${campaign} AND sa.status='ACTIVE'`;
  }

  private async replay<T>(transaction: sql.Transaction, tenantId: string, input: WriteContext, operation: string): Promise<T | "IDEMPOTENCY_CONFLICT" | null> {
    const row = (await new sql.Request(transaction).input("tenant", tenantId).input("actor", input.actorAccountId).input("operation", operation).input("key", input.idempotencyKey).query<Replay>(`SELECT request_hash AS requestHash,response_json AS responseJson FROM [C_audit].idempotency_record WITH(UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant AND actor_account_id=@actor AND operation=@operation AND idempotency_key=@key;`)).recordset[0];
    if (row === undefined) return null;
    if (!row.requestHash.equals(input.requestHash)) return "IDEMPOTENCY_CONFLICT";
    return { ...(JSON.parse(row.responseJson) as T), replayed: true };
  }

  private async finish(transaction: sql.Transaction, tenantId: string, input: WriteContext, operation: string, resourceType: string, resourceId: string, response: unknown): Promise<void> {
    const json = JSON.stringify(response);
    await new sql.Request(transaction).input("id", randomUUID()).input("tenant", tenantId).input("actor", input.actorAccountId).input("subject", input.subjectHash).input("operation", operation).input("key", input.idempotencyKey).input("hash", input.requestHash).input("response", json).input("resourceType", resourceType).input("resourceId", resourceId).input("correlation", input.correlationId).input("now", input.now).query(`
      INSERT INTO [C_audit].idempotency_record(idempotency_record_id,tenant_id,actor_account_id,subject_hash,operation,idempotency_key,request_hash,status,response_status,response_json,resource_type,resource_id,created_at_utc,completed_at_utc)
      VALUES(@id,@tenant,@actor,@subject,@operation,@key,@hash,'COMPLETED',200,@response,@resourceType,@resourceId,@now,@now);
      INSERT INTO [C_audit].audit_event(tenant_id,actor_account_id,action,entity_type,entity_id,correlation_id,after_json,occurred_at_utc)
      VALUES(@tenant,@actor,@operation,@resourceType,@resourceId,@correlation,@response,@now);`);
  }

  private async transaction<T>(work: (transaction: sql.Transaction) => Promise<T>): Promise<T> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try { const result = await work(transaction); await transaction.commit(); return result; }
    catch (error) { await transaction.rollback(); throw error; }
  }
}
