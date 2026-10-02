import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  databaseUrl,
  loadLocalEnvironment,
} from "../../scripts/database-url.mjs";

/** Configure and verify the actual adapter connection, before Prisma uses it. */
class LocalSqliteAdapter extends PrismaBetterSqlite3 {
  constructor(
    url: string,
    private readonly onQuery?: (sql: string) => void,
  ) {
    super({ url, timeout: 5000 }, { timestampFormat: "iso8601" });
  }
  async connect() {
    const adapter = await super.connect();
    try {
      const mode = await adapter.queryRaw({
        sql: "PRAGMA journal_mode = WAL",
        args: [],
        argTypes: [],
      });
      const timeout = await adapter.queryRaw({
        sql: "PRAGMA busy_timeout = 5000",
        args: [],
        argTypes: [],
      });
      if (
        String(mode.rows[0]?.[0]).toLowerCase() !== "wal" ||
        Number(timeout.rows[0]?.[0]) !== 5000
      )
        throw new Error("SQLite WAL/busy timeout could not be configured");
      if (this.onQuery) {
        const queryRaw = adapter.queryRaw.bind(adapter);
        adapter.queryRaw = (query) => {
          this.onQuery?.(query.sql);
          return queryRaw(query);
        };
      }
      return adapter;
    } catch (error) {
      await adapter.dispose();
      throw error;
    }
  }
}

/** Shared by the web server, local worker and seed scripts. */
export function createPrismaClient(
  options: { onQuery?: (sql: string) => void } = {},
) {
  loadLocalEnvironment();
  return new PrismaClient({
    adapter: new LocalSqliteAdapter(databaseUrl(), options.onQuery),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
