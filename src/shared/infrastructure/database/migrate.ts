import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

import { createConnectionPool } from "./connection-pool.js";
import { loadDatabaseConfig } from "./database-config.js";
import { loadMigrations, type Migration } from "./migration-loader.js";

type AppliedMigration = Readonly<{ version: string; checksum: string }>;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(currentDirectory, "../../../../migrations");

async function migrationTableExists(pool: sql.ConnectionPool): Promise<boolean> {
  const result = await pool.request().query<{ exists_flag: number }>(`
    SELECT CASE WHEN OBJECT_ID(N'infra.schema_migration', N'U') IS NULL THEN 0 ELSE 1 END AS exists_flag;
  `);
  return result.recordset[0]?.exists_flag === 1;
}

async function readAppliedMigrations(pool: sql.ConnectionPool): Promise<Map<string, AppliedMigration>> {
  if (!(await migrationTableExists(pool))) {
    return new Map();
  }

  const result = await pool.request().query<AppliedMigration>(`
    SELECT version, checksum FROM infra.schema_migration ORDER BY version;
  `);
  return new Map(result.recordset.map((migration) => [migration.version, migration]));
}

async function applyMigration(pool: sql.ConnectionPool, migration: Migration): Promise<void> {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const startedAt = performance.now();

  try {
    const lockResult = await new sql.Request(transaction)
      .input("resource", sql.NVarChar(255), "colportando-schema-migrations")
      .query<{ result: number }>(`
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock
          @Resource = @resource,
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 30000;
        SELECT @result AS result;
      `);

    if ((lockResult.recordset[0]?.result ?? -999) < 0) {
      throw new Error(`Could not acquire migration lock for ${migration.version}`);
    }

    await new sql.Request(transaction).batch(migration.sql);
    const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
    await new sql.Request(transaction)
      .input("version", sql.VarChar(40), migration.version)
      .input("name", sql.NVarChar(200), migration.name)
      .input("checksum", sql.Char(64), migration.checksum)
      .input("executionMs", sql.Int, executionMs)
      .query(`
        INSERT INTO infra.schema_migration(version, name, checksum, execution_ms)
        VALUES (@version, @name, @checksum, @executionMs);
      `);
    await transaction.commit();
    process.stdout.write(
      `Applied ${migration.version}_${migration.name} (${String(executionMs)} ms)\n`
    );
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

async function main(): Promise<void> {
  const pool = createConnectionPool(loadDatabaseConfig());
  await pool.connect();

  try {
    const migrations = await loadMigrations(migrationDirectory);
    const applied = await readAppliedMigrations(pool);

    for (const migration of migrations) {
      const prior = applied.get(migration.version);
      if (prior !== undefined) {
        if (prior.checksum.toUpperCase() !== migration.checksum) {
          throw new Error(`Checksum mismatch for applied migration ${migration.version}`);
        }
        continue;
      }
      await applyMigration(pool, migration);
    }
  } finally {
    await pool.close();
  }
}

await main();
