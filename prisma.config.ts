import { defineConfig } from "prisma/config";
import { databaseUrl, loadLocalEnvironment } from "./scripts/database-url.mjs";

loadLocalEnvironment();
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl() },
});
