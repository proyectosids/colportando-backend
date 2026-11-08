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
  SWAGGER_ENABLED: booleanFromString.optional(),
  JWT_ISSUER: z.string().min(1).default("colportando-backend"),
  JWT_AUDIENCE: z.string().min(1).default("colportando-clients"),
  JWT_ACCESS_SECRET: z.string().min(32).default("development-only-access-secret-change-me"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  ACTION_TOKEN_PEPPER: z.string().min(32).default("development-only-token-pepper-change-me"),
  AUTH_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).default(2_592_000),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).default(7_776_000),
  AUTH_ACTION_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3_600),
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(12)
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy: boolean;
  corsAllowedOrigins: readonly string[];
  swaggerEnabled: boolean;
  auth: Readonly<{
    jwtIssuer: string;
    jwtAudience: string;
    jwtAccessSecret: string;
    accessTtlSeconds: number;
    tokenPepper: string;
    refreshTtlSeconds: number;
    sessionTtlSeconds: number;
    actionTokenTtlSeconds: number;
    passwordMinLength: number;
  }>;
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
  if (parsed.data.NODE_ENV === "production" && (parsed.data.JWT_ACCESS_SECRET.startsWith("development-only-") || parsed.data.ACTION_TOKEN_PEPPER.startsWith("development-only-"))) {
    throw new Error("Invalid application configuration: production authentication secrets must be configured");
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    trustProxy: parsed.data.TRUST_PROXY,
    corsAllowedOrigins,
    swaggerEnabled: parsed.data.SWAGGER_ENABLED ?? parsed.data.NODE_ENV !== "production",
    auth: {
      jwtIssuer: parsed.data.JWT_ISSUER,
      jwtAudience: parsed.data.JWT_AUDIENCE,
      jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
      accessTtlSeconds: parsed.data.JWT_ACCESS_TTL_SECONDS,
      tokenPepper: parsed.data.ACTION_TOKEN_PEPPER,
      refreshTtlSeconds: parsed.data.AUTH_REFRESH_TTL_SECONDS,
      sessionTtlSeconds: parsed.data.AUTH_SESSION_TTL_SECONDS,
      actionTokenTtlSeconds: parsed.data.AUTH_ACTION_TOKEN_TTL_SECONDS,
      passwordMinLength: parsed.data.AUTH_PASSWORD_MIN_LENGTH
    }
  };
}
