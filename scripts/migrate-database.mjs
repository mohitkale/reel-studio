#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { databaseUrl, loadLocalEnvironment } from "./database-url.mjs";

const baseline = "20260910000100_baseline";

function withoutPhysicalColumnId(row) {
  const normalized = { ...row };
  delete normalized.cid;
  return normalized;
}

/** Compare schema structure, not user data or SQLite's SQL whitespace. */
export function schemaSignature(db) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name",
    )
    .all();
  return JSON.stringify(
    tables.map(({ name }) => {
      const quote = `'${name.replaceAll("'", "''")}'`;
      const columns = db
        .prepare(`PRAGMA table_info(${quote})`)
        .all()
        .map(withoutPhysicalColumnId)
        .sort((a, b) => a.name.localeCompare(b.name));
      const indexes = db
        .prepare(`PRAGMA index_list(${quote})`)
        .all()
        .map(({ name: index, unique, origin, partial }) => ({
          name: index,
          unique,
          origin,
          partial,
          columns: db
            .prepare(`PRAGMA index_info('${index.replaceAll("'", "''")}')`)
            .all()
            .map(withoutPhysicalColumnId),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        name,
        // `prisma db push` may append a newly introduced column while a generated
        // baseline places it in model order. Column order does not change SQLite
        // semantics, so compare definitions by name and omit the physical cid.
        columns,
        foreignKeys: db.prepare(`PRAGMA foreign_key_list(${quote})`).all(),
        indexes,
      };
    }),
  );
}

export function inspectAndBackup(filename) {
  mkdirSync(path.dirname(filename), { recursive: true });
  if (!existsSync(filename)) {
    // Prisma's schema engine expects the SQLite file to exist on this path.
    new DatabaseSync(filename).close();
    return { needsBaseline: false, backup: null };
  }
  const db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA busy_timeout=1000");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    if (!tables.length) return { needsBaseline: false, backup: null };
    const migrated = tables.some((t) => t.name === "_prisma_migrations");
    if (!migrated) {
      const expected = new DatabaseSync(":memory:");
      try {
        expected.exec(readFileSync(path.resolve(`prisma/migrations/${baseline}/migration.sql`), "utf8"));
        if (schemaSignature(db) !== schemaSignature(expected)) {
          throw new Error("Unrecognized SQLite schema. No migration applied. Restore a supported v0.3.0 database or reconcile schema drift before retrying.");
        }
      } finally { expected.close(); }
    }
    // VACUUM INTO creates a consistent SQLite snapshot, including WAL contents.
    const backup = `${filename}.backup-${Date.now()}`;
    db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    return { needsBaseline: !migrated, backup };
  } finally { db.close(); }
}

function prisma(args) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Database migration command failed (${result.status}). Restore the backup before rolling back the application.`);
}

export function main() {
  loadLocalEnvironment();
  if (existsSync(".artifacts/production-worker.lock")) throw new Error("Stop the production worker before migrating the database.");
  const { needsBaseline, backup } = inspectAndBackup(databaseUrl().slice(5));
  if (backup) console.log("Created a consistent database backup beside the SQLite file.");
  if (needsBaseline) prisma(["migrate", "resolve", "--applied", baseline]);
  prisma(["migrate", "deploy"]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
