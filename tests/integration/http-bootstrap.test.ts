import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp } from "../../src/composition/create-app.js";
import { healthResponseSchema } from "../../src/modules/health/presentation/http/health-schema.js";
import type { AppConfig } from "../../src/shared/infrastructure/config/env.js";
import { errorResponseSchema } from "../../src/shared/presentation/http/schemas/error-schema.js";

const openApiTestSchema = z.object({
  openapi: z.string(),
  paths: z.object({
    "/api/v1/health": z.object({ get: z.object({ operationId: z.string() }) })
  }),
  components: z.object({
    securitySchemes: z.object({
      bearerAuth: z.object({ type: z.string(), scheme: z.string() })
    })
  })
});

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 3000,
    logLevel: "silent",
    trustProxy: false,
    corsAllowedOrigins: ["https://flutter.example", "https://web.example"],
    swaggerEnabled: true,
    auth: {
      jwtIssuer: "test-issuer",
      jwtAudience: "test-audience",
      jwtAccessSecret: "test-access-secret-at-least-32-characters",
      accessTtlSeconds: 900,
      tokenPepper: "test-token-pepper-at-least-32-characters",
      refreshTtlSeconds: 2_592_000,
      sessionTtlSeconds: 7_776_000,
      actionTokenTtlSeconds: 3_600,
      passwordMinLength: 12
    },
    mail: {
      adapter: "disabled",
      fromName: "Colportando App",
      actionBaseUrl: "https://app.example/auth"
    },
    ...overrides
  };
}

function testApp(overrides: Partial<AppConfig> = {}) {
  return createApp({
    config: testConfig(overrides),
    logger: pino({ level: "silent" })
  });
}

describe("HTTP bootstrap", () => {
  it("reports process health without database configuration", async () => {
    const response = await request(testApp()).get("/api/v1/health").expect(200);

    const body = healthResponseSchema.parse(response.body as unknown);
    expect(body).toMatchObject({
      status: "ok",
      service: "colportando-backend"
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("publishes the OpenAPI contract", async () => {
    const response = await request(testApp()).get("/api/openapi.json").expect(200);

    const body = openApiTestSchema.parse(response.body as unknown);
    expect(body.openapi).toBe("3.0.3");
    expect(body.paths["/api/v1/health"].get.operationId).toBe("getHealth");
    expect(body.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer"
    });
  });

  it("serves Swagger only when enabled", async () => {
    await request(testApp()).get("/api/docs/").expect(200).expect("content-type", /html/);

    const disabled = await request(testApp({ swaggerEnabled: false })).get("/api/docs/").expect(404);
    expect(errorResponseSchema.parse(disabled.body as unknown).error.code).toBe("ROUTE_NOT_FOUND");
    await request(testApp({ swaggerEnabled: false })).get("/api/openapi.json").expect(404);
  });

  it("returns a safe 400 response for malformed JSON", async () => {
    const response = await request(testApp())
      .post("/api/v1/missing")
      .set("content-type", "application/json")
      .send('{"broken"')
      .expect(400);

    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe("INVALID_JSON");
  });

  it("returns a consistent 404 envelope with correlation id", async () => {
    const response = await request(testApp()).get("/missing").expect(404);

    const body = errorResponseSchema.parse(response.body as unknown);
    expect(body.error).toMatchObject({
      code: "ROUTE_NOT_FOUND",
      message: "Route GET /missing was not found"
    });
    expect(body.error.correlationId).toBe(response.headers["x-correlation-id"]);
    expect(body.error.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("preserves a valid incoming correlation id", async () => {
    const correlationId = "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14";
    const response = await request(testApp())
      .get("/api/v1/health")
      .set("x-correlation-id", correlationId)
      .expect(200);

    expect(response.headers["x-correlation-id"]).toBe(correlationId);
  });
});
