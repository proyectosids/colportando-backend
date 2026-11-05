import { z } from "zod";

const booleanFromString = z.enum(["true", "false"]).transform((value) => value === "true");

const databaseEnvSchema = z.object({
  SQL_SERVER: z.string().trim().min(1),
  SQL_PORT: z.coerce.number().int().min(1).max(65_535).default(1433),
  SQL_DATABASE: z.string().trim().min(1),
  SQL_USER: z.string().trim().min(1),
  SQL_PASSWORD: z.string().min(1),
  SQL_ENCRYPT: booleanFromString.default(true),
  SQL_TRUST_SERVER_CERTIFICATE: booleanFromString.default(false),
  SQL_POOL_MAX: z.coerce.number().int().positive().default(10),
  SQL_POOL_MIN: z.coerce.number().int().min(0).default(0),
  SQL_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000)
});

export type DatabaseConfig = Readonly<{
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  poolMax: number;
  poolMin: number;
  poolIdleTimeoutMs: number;
}>;

export function loadDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const parsed = databaseEnvSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(`Invalid database configuration: ${z.prettifyError(parsed.error)}`);
  }

  return {
    server: parsed.data.SQL_SERVER,
    port: parsed.data.SQL_PORT,
    database: parsed.data.SQL_DATABASE,
    user: parsed.data.SQL_USER,
    password: parsed.data.SQL_PASSWORD,
    encrypt: parsed.data.SQL_ENCRYPT,
    trustServerCertificate: parsed.data.SQL_TRUST_SERVER_CERTIFICATE,
    poolMax: parsed.data.SQL_POOL_MAX,
    poolMin: parsed.data.SQL_POOL_MIN,
    poolIdleTimeoutMs: parsed.data.SQL_POOL_IDLE_TIMEOUT_MS
  };
}
