import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { healthResponseSchema } from "../../../../modules/health/presentation/http/health-schema.js";
import { errorResponseSchema } from "../schemas/error-schema.js";

export function createOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.register("HealthResponse", healthResponseSchema);
  registry.register("ErrorResponse", errorResponseSchema);
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Access token obtained from the authentication API."
  });
  registry.registerPath({
    method: "get",
    path: "/api/v1/health",
    operationId: "getHealth",
    tags: ["System"],
    summary: "Check API process health",
    description: "Reports whether the HTTP process is running. It does not open a SQL Server connection.",
    responses: {
      200: {
        description: "The HTTP process is healthy.",
        content: {
          "application/json": {
            schema: healthResponseSchema
          }
        }
      },
      500: {
        description: "Unexpected server error.",
        content: {
          "application/json": {
            schema: errorResponseSchema
          }
        }
      }
    }
  });

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Colportando API",
      version: "0.1.0",
      description: "Versioned SaaS API for Flutter and React clients."
    },
    servers: [{ url: "/", description: "Current server" }],
    tags: [{ name: "System", description: "Operational API endpoints" }]
  });
}

export type OpenApiDocument = ReturnType<typeof createOpenApiDocument>;
