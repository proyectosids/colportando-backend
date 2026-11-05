import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: booleanFromString.default(false),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  SWAGGER_ENABLED: booleanFromString.optional()
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy: boolean;
  corsAllowedOrigins: readonly string[];
  swaggerEnabled: boolean;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(`Invalid application configuration: ${z.prettifyError(parsed.error)}`);
  }

  const corsAllowedOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsAllowedOrigins.length === 0) {
    throw new Error("Invalid application configuration: CORS_ALLOWED_ORIGINS cannot be empty");
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    trustProxy: parsed.data.TRUST_PROXY,
    corsAllowedOrigins,
    swaggerEnabled: parsed.data.SWAGGER_ENABLED ?? parsed.data.NODE_ENV !== "production"
  };
}
