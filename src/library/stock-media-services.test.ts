// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const previousDatabaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  const globalWithPrisma = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await globalWithPrisma.prisma?.$disconnect();
  delete globalWithPrisma.prisma;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  vi.resetModules();
});

describe("stock-media service repository", () => {
  it("persists cache, monotonic quota, and materialization records", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-stock-service-"));
    const filename = path.join(directory, "service.db");
    const db = new DatabaseSync(filename);
    try {
      for (const migration of readdirSync("prisma/migrations")
        .filter((name) => !name.endsWith(".toml"))
        .sort()) {
        db.exec(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
      }
    } finally {
      db.close();
    }
    process.env.DATABASE_URL = `file:${filename}`;
    vi.resetModules();

    try {
      const { stockMediaServiceRepository: repository } =
        await import("./repositories/stock-media-services");
      await repository.putCache({
        requestHash: "request",
        providerId: "fixture",
        operation: "search",
        requestJson: '{"query":"ocean"}',
        responseJson: '{"items":[]}',
        expiresAt: new Date("2026-09-15T00:00:00.000Z"),
      });
      await expect(repository.getCache("request")).resolves.toMatchObject({
        providerId: "fixture",
      });

      await repository.putQuota("fixture", {
        limit: 100,
        remaining: 80,
        observedAt: "2026-09-14T14:31:00.000Z",
      });
      await repository.putQuota("fixture", {
        limit: 100,
        remaining: 90,
        observedAt: "2026-09-14T14:30:00.000Z",
      });
      await expect(repository.getQuota("fixture")).resolves.toMatchObject({
        remaining: 80,
        observedAt: "2026-09-14T14:31:00.000Z",
      });

      const hash = "a".repeat(64);
      const materialization = await repository.putMaterialization({
        requestHash: "materialized",
        providerId: "fixture",
        providerAssetId: "photo-1",
        renditionId: "large",
        sourceUrl: "https://cdn.example.test/photo.png",
        assetId: `stock-${hash}`,
        assetType: "image",
        storeKey: `stock-media/${hash}.png`,
        contentHash: hash,
        metadataJson: JSON.stringify({
          kind: "image",
          mimeType: "image/png",
          extension: "png",
          width: 1,
          height: 1,
          bytes: 68,
        }),
        assetName: "Fixture Creator · fixture",
      });
      expect(materialization.assetId).toBe(`stock-${hash}`);
      await expect(
        repository.getMaterialization("materialized"),
      ).resolves.toMatchObject({
        providerAssetId: "photo-1",
        contentHash: hash,
      });
    } finally {
      const globalWithPrisma = globalThis as typeof globalThis & {
        prisma?: { $disconnect(): Promise<void> };
      };
      await globalWithPrisma.prisma?.$disconnect();
      delete globalWithPrisma.prisma;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
