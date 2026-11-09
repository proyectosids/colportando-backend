import { createOpenApiDocument } from "../src/shared/presentation/http/openapi/document.js";

const document = createOpenApiDocument();
const healthOperation = document.paths["/api/v1/health"]?.get;
const loginOperation = document.paths["/api/v1/auth/login"]?.post;
const invitationOperation = document.paths["/api/v1/auth/invitations"]?.post;
const trainingOperation = document.paths["/api/v1/training/programs"]?.post;
const promotionOperation=document.paths["/api/v1/training/enrollments/{enrollmentId}/promotion-decisions"]?.post;
const campaignOperation=document.paths["/api/v1/operations/campaigns"]?.post;
const catalogOperation=document.paths["/api/v1/inventory/campaigns/{campaignId}/catalogs"]?.post;
const workspaceOperation=document.paths["/api/v1/workspace/context"]?.get;
const bearerScheme = document.components?.securitySchemes?.bearerAuth;

if (document.openapi !== "3.0.3") {
  throw new Error(`Unexpected OpenAPI version: ${document.openapi}`);
}

if (healthOperation?.operationId !== "getHealth") {
  throw new Error("Health operation is absent from the OpenAPI document");
}
if (loginOperation?.operationId !== "login") {
  throw new Error("Authentication operations are absent from the OpenAPI document");
}
if (invitationOperation?.operationId !== "createClubInvitation") {
  throw new Error("Invitation operations are absent from the OpenAPI document");
}
if (trainingOperation?.operationId !== "createTrainingProgram") {
  throw new Error("Training operations are absent from the OpenAPI document");
}
if(promotionOperation?.operationId!=="decideTrainingPromotion") throw new Error("Member transition operations are absent from the OpenAPI document");
if(campaignOperation?.operationId!=="createCampaign")throw new Error("Campaign operations are absent from the OpenAPI document");
if(catalogOperation?.operationId!=="createCampaignCatalog")throw new Error("Catalog operations are absent from the OpenAPI document");
if(workspaceOperation?.operationId!=="getWorkspaceContext")throw new Error("Workspace operations are absent from the OpenAPI document");

if (bearerScheme === undefined || !("type" in bearerScheme) || bearerScheme.type !== "http") {
  throw new Error("bearerAuth security scheme is absent or invalid");
}

const serialized = JSON.stringify(document);
if (serialized.includes("replace-me") || serialized.includes("SQL_PASSWORD")) {
  throw new Error("OpenAPI document contains a credential placeholder");
}

process.stdout.write("OpenAPI document checks passed.\n");
