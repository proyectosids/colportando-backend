import { createOpenApiDocument } from "../src/shared/presentation/http/openapi/document.js";

const document = createOpenApiDocument();
const healthOperation = document.paths["/api/v1/health"]?.get;
const loginOperation = document.paths["/api/v1/auth/login"]?.post;
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

if (bearerScheme === undefined || !("type" in bearerScheme) || bearerScheme.type !== "http") {
  throw new Error("bearerAuth security scheme is absent or invalid");
}

const serialized = JSON.stringify(document);
if (serialized.includes("replace-me") || serialized.includes("SQL_PASSWORD")) {
  throw new Error("OpenAPI document contains a credential placeholder");
}

process.stdout.write("OpenAPI document checks passed.\n");
