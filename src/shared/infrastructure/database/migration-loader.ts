import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const upMigrationPattern = /^(?<version>\d{4})_(?<name>[a-z0-9_]+)\.up\.sql$/;

export type Migration = Readonly<{
  version: string;
  name: string;
  checksum: string;
  sql: string;
}>;

export async function loadMigrations(directory: string): Promise<readonly Migration[]> {
  const files = await readdir(directory);
  const migrations = await Promise.all(
    files
      .filter((fileName) => upMigrationPattern.test(fileName))
      .map(async (fileName) => {
        const match = upMigrationPattern.exec(fileName);
        const version = match?.groups?.version;
        const name = match?.groups?.name;
        if (version === undefined || name === undefined) {
          throw new Error(`Invalid migration file name: ${fileName}`);
        }

        const sql = await readFile(path.join(directory, fileName), "utf8");
        return {
          version,
          name,
          checksum: createHash("sha256").update(sql, "utf8").digest("hex").toUpperCase(),
          sql
        } satisfies Migration;
      })
  );

  migrations.sort((left, right) => left.version.localeCompare(right.version));
  const versions = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return migrations;
}
