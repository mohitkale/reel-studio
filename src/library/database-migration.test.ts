// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectAndBackup } from "../../scripts/migrate-database.mjs";
import { databaseUrl } from "../../scripts/database-url.mjs";
import { createPrismaClient } from "./prisma-client";

describe("SQLite migration preparation", () => {
  it("preserves legacy relative URL resolution", () => {
    expect(databaseUrl("file:./dev.db")).toBe(`file:${path.resolve("prisma/dev.db")}`);
  });
  it("recognizes a populated legacy database and preserves its rows in backup", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-migration-"));
    try {
      const filename = path.join(directory, "legacy.db");
      const db = new DatabaseSync(filename);
      db.exec(readFileSync("prisma/migrations/20260910000100_baseline/migration.sql", "utf8"));
      db.exec("INSERT INTO Project (id,name,updatedAt) VALUES ('saved','Existing project',CURRENT_TIMESTAMP)");
      db.close();
      const result = inspectAndBackup(filename);
      expect(result.needsBaseline).toBe(true);
      const restored = new DatabaseSync(result.backup!);
      expect(restored.prepare("SELECT name FROM Project WHERE id='saved'").get()?.name).toBe("Existing project");
      restored.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("rejects unknown schema without modifying it", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-drift-"));
    try {
      const filename = path.join(directory, "drift.db");
      const db = new DatabaseSync(filename);
      db.exec("CREATE TABLE Unknown (id INTEGER)");
      db.close();
      expect(() => inspectAndBackup(filename)).toThrow("Unrecognized SQLite schema");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("allows a fresh database", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-fresh-"));
    try { expect(inspectAndBackup(path.join(directory, "new.db")).needsBaseline).toBe(false); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("reads legacy dates and writes through the upgraded Prisma adapter", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-adapter-"));
    const previous = process.env.DATABASE_URL;
    const filename = path.join(directory, "adapter.db");
    const db = new DatabaseSync(filename);
    db.exec(readFileSync("prisma/migrations/20260910000100_baseline/migration.sql", "utf8"));
    db.exec("INSERT INTO Project (id,name,updatedAt) VALUES ('legacy','Saved before upgrade','2026-08-06T10:00:00.000Z')");
    db.close();
    process.env.DATABASE_URL = `file:${filename}`;
    const client = createPrismaClient();
    try {
      const legacy = await client.project.findUniqueOrThrow({ where: { id: "legacy" } });
      expect(legacy.updatedAt.toISOString()).toBe("2026-08-06T10:00:00.000Z");
      const created = await client.project.create({ data: { name: "New project" } });
      expect(created.videoEngine).toBe("hyperframes");
      expect(await client.project.count()).toBe(2);
    } finally {
      await client.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
