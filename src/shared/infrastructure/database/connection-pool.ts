import sql from "mssql";

import type { DatabaseConfig } from "./database-config.js";

export function createConnectionPool(config: DatabaseConfig): sql.ConnectionPool {
  return new sql.ConnectionPool({
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    options: {
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate,
      enableArithAbort: true
    },
    pool: {
      max: config.poolMax,
      min: config.poolMin,
      idleTimeoutMillis: config.poolIdleTimeoutMs
    }
  });
}
