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
      SWAGGER_ENABLED: "false",
      AUTH_RATE_LIMIT_MAX_REQUESTS: "100",
      AUTH_RATE_LIMIT_WINDOW_SECONDS: "300"
    });

    expect(config).toMatchObject({
      nodeEnv: "test",
      port: 4000,
      trustProxy: true,
      swaggerEnabled: false,
      rateLimitEnabled: false,
      authRateLimitMaxRequests: 100,
      authRateLimitWindowSeconds: 300,
      corsAllowedOrigins: ["https://app.example", "https://admin.example"]
    });
  });

  it("rejects invalid configuration", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow("Invalid application configuration");
  });

  it("disables API documentation by default in production", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "production-access-secret-at-least-32-characters",
      ACTION_TOKEN_PEPPER: "production-token-pepper-at-least-32-characters",
      AUTH_ACTION_BASE_URL: "https://app.example/auth"
    });
    expect(config.swaggerEnabled).toBe(false);
    expect(config.rateLimitEnabled).toBe(true);
  });

  it("allows an explicit production override for authentication rate limiting", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "production-access-secret-at-least-32-characters",
      ACTION_TOKEN_PEPPER: "production-token-pepper-at-least-32-characters",
      AUTH_RATE_LIMIT_ENABLED: "false",
      AUTH_RATE_LIMIT_MAX_REQUESTS: "100",
      AUTH_RATE_LIMIT_WINDOW_SECONDS: "300"
    });
    expect(config).toMatchObject({
      rateLimitEnabled: false,
      authRateLimitMaxRequests: 100,
      authRateLimitWindowSeconds: 300
    });
  });

  it("prefers the Gmail application password", () => {
    const config = loadConfig({ MAIL_ADAPTER: "gmail", AUTH_EMAIL: "mailer@example.com", AUTH_PASS: "account-password", AUTH_PASS_APP: "application-password" });
    expect(config.mail).toMatchObject({ adapter: "gmail", email: "mailer@example.com", password: "application-password", fromName: "Colportando App" });
  });
});
