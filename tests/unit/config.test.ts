import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/shared/infrastructure/config/env.js";

describe("loadConfig", () => {
  it("normalizes allowed origins and booleans", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "4000",
      LOG_LEVEL: "silent",
      TRUST_PROXY: "true",
      CORS_ALLOWED_ORIGINS: "https://app.example, https://admin.example",
      SWAGGER_ENABLED: "false"
    });

    expect(config).toMatchObject({
      nodeEnv: "test",
      port: 4000,
      trustProxy: true,
      swaggerEnabled: false,
      corsAllowedOrigins: ["https://app.example", "https://admin.example"]
    });
  });

  it("rejects invalid configuration", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow("Invalid application configuration");
  });

  it("disables API documentation by default in production", () => {
    expect(loadConfig({ NODE_ENV: "production" }).swaggerEnabled).toBe(false);
  });
});
