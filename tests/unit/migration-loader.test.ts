import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadMigrations } from "../../src/shared/infrastructure/database/migration-loader.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("loadMigrations", () => {
  it("orders up migrations and calculates a stable checksum", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "colportando-migrations-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "0002_second.up.sql"), "SELECT 2;", "utf8");
    await writeFile(path.join(directory, "0001_first.up.sql"), "SELECT 1;", "utf8");
    await writeFile(path.join(directory, "0001_first.down.sql"), "SELECT 0;", "utf8");

    const migrations = await loadMigrations(directory);

    expect(migrations.map(({ version }) => version)).toEqual(["0001", "0002"]);
    expect(migrations[0]?.checksum).toMatch(/^[0-9A-F]{64}$/);
  });
});
