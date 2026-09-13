import path from "node:path";
import { existsSync } from "node:fs";

/** Match Next's local environment precedence without printing credentials. */
export function loadLocalEnvironment() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

/** Prisma 6 resolved relative SQLite URLs beside schema.prisma. Preserve that. */
export function databaseUrl(value = process.env.DATABASE_URL ?? "file:./dev.db") {
  if (!value.startsWith("file:")) throw new Error("Reel Studio requires a local SQLite file URL");
  const location = value.slice(5);
  if (!location || location.includes("?") || location.includes("#")) throw new Error("Invalid SQLite file URL");
  return `file:${path.isAbsolute(location) ? location : path.resolve("prisma", location)}`;
}
