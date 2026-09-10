import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { databaseUrl, loadLocalEnvironment } from "../../scripts/database-url.mjs";

/** Shared by the web server, local worker and seed scripts. */
export function createPrismaClient() {
  loadLocalEnvironment();
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl() }, { timestampFormat: "iso8601" }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
