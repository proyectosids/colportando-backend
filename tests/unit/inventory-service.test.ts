import { describe, expect, it, vi } from "vitest";

import { InventoryService } from "../../src/modules/inventory/application/inventory-service.js";
import type { InventoryStore } from "../../src/modules/inventory/application/ports/inventory-store.js";

const actor="616ef081-6319-4c77-99d7-445bc64022fc",club="1454389c-dc3c-411a-ad84-1f2e294470bc",campaign="8b362786-e89a-42bd-b527-ccac260fcd2f",catalog="b0641547-c7f6-4ed9-b1dd-2de23c7c46c4",participation="7f7bdfcb-8798-470b-9859-30840a6fb860",item="93932f10-8732-449c-b7fb-6530fd8aa782";
function fixture(){const store:InventoryStore={createMaterial:vi.fn().mockResolvedValue({materialId:item,code:"BOOK",name:"Libro",status:"ACTIVE",replayed:false}),createCatalog:vi.fn(),addCatalogItem:vi.fn(),changeCatalogStatus:vi.fn(),createAcquisition:vi.fn().mockResolvedValue({acquisitionId:item,campaignId:campaign,participationId:participation,catalogId:catalog,acquiredAt:"2027-01-10T12:00:00.000Z",status:"REGISTERED",currency:"MXN",total:"100.0000",replayed:false}),changeAcquisitionStatus:vi.fn(),readMaterials:vi.fn(),readCampaignCatalog:vi.fn().mockResolvedValue("FORBIDDEN"),readCampaignAcquisitions:vi.fn(),readMyAcquisitions:vi.fn()};return{store,service:new InventoryService(store,()=>new Date("2026-11-09T12:00:00Z"))};}
describe("InventoryService",()=>{it("normalizes material code and never accepts tenant from the client",async()=>{const{service,store}=fixture();await service.createMaterial({actorAccountId:actor,clubId:club,code:" book ",name:" Libro  básico ",idempotencyKey:"material-001",correlationId:campaign});
// eslint-disable-next-line @typescript-eslint/unbound-method
const input=vi.mocked(store.createMaterial).mock.calls[0]?.[0];expect(input).toMatchObject({code:"BOOK",name:"Libro básico",clubId:club});expect(input).not.toHaveProperty("tenantId");});
it("sends only item and quantity so the store snapshots the server price",async()=>{const{service,store}=fixture();await service.createAcquisition({actorAccountId:actor,campaignId:campaign,participationId:participation,catalogId:catalog,acquiredAt:"2027-01-10T12:00:00.000Z",lines:[{catalogItemId:item,quantity:2}],idempotencyKey:"acquisition-001",correlationId:campaign});
// eslint-disable-next-line @typescript-eslint/unbound-method
const input=vi.mocked(store.createAcquisition).mock.calls[0]?.[0];expect(input?.lines[0]).toMatchObject({catalogItemId:item,quantity:2});expect(input?.lines[0]).not.toHaveProperty("unitPrice");});
it("maps store authorization failures to a safe error",async()=>{const{service}=fixture();await expect(service.getCampaignCatalog(actor,campaign)).rejects.toMatchObject({statusCode:403,code:"INVENTORY_FORBIDDEN"});});});
