// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ResolvedStockAsset } from "@/providers/stock/schemas";

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

describe("stock-media scene persistence", () => {
  it("applies atomically, preserves effect edits, and clears metadata without deleting cached media", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-stock-selection-"));
    const filename = path.join(directory, "selection.db");
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
      const { prisma } = await import("./db");
      const selections = await import("./repositories/stock-media-selections");
      const { updateScene } = await import("./repositories/scenes");
      const { createProjectFromPlan } = await import("./repositories/projects");
      await prisma.project.create({
        data: {
          id: "project-1",
          name: "Stock test",
          scripts: {
            create: {
              id: "script-1",
              name: "Script",
              scenes: {
                create: {
                  id: "scene-1",
                  order: 0,
                  templateId: "stat-reveal",
                  text: "Scene",
                },
              },
            },
          },
        },
      });
      await prisma.asset.create({
        data: {
          id: "stock-asset",
          type: "image",
          name: "Stock image",
          path: "stock-media/test.jpg",
        },
      });
      const candidate = {
        providerId: "pexels",
        providerAssetId: "42",
        kind: "image" as const,
        previewUrl: "https://images.example.test/preview.jpg",
        sourcePageUrl: "https://www.example.test/photo/42",
        creator: "Creator",
        width: 1080,
        height: 1920,
        orientation: "portrait" as const,
        mimeType: "image/jpeg",
        renderRenditions: [
          {
            id: "portrait",
            url: "https://images.example.test/photo.jpg",
            width: 1080,
            height: 1920,
            mimeType: "image/jpeg",
          },
        ],
        attribution: { text: "Photo by Creator", required: true },
        acquisitionPolicy: "download" as const,
      };
      const snapshot: ResolvedStockAsset = {
        schemaVersion: 1,
        resolvedAt: "2026-09-15T01:00:00.000Z",
        localAssetId: "stock-asset",
        contentHash: "a".repeat(64),
        providerSnapshot: candidate,
        selectedRendition: candidate.renderRenditions[0]!,
        sourceRevision: {
          capturedAt: "2026-09-15T01:00:00.000Z",
          termsUrl: "https://www.pexels.com/license/",
        },
        usageEvent: { state: "not-required" },
      };

      await selections.applyStockMediaSelection("scene-1", snapshot, {
        type: "image",
        url: "/media/stock-media/test.jpg",
        effect: "ken-burns",
      });
      await expect(
        selections.getStockMediaSelection("scene-1"),
      ).resolves.toMatchObject({
        snapshot: { providerSnapshot: { providerAssetId: "42" } },
      });

      await updateScene("scene-1", {
        background: {
          type: "image",
          url: "/media/stock-media/test.jpg",
          effect: "pan-left",
        },
      });
      await expect(
        selections.getStockMediaSelection("scene-1"),
      ).resolves.not.toBeNull();

      const cleared = await selections.clearSceneStockMedia("scene-1");
      expect(cleared.mediaPreference).toBe("none");
      await expect(
        selections.getStockMediaSelection("scene-1"),
      ).resolves.toBeNull();
      await expect(
        prisma.asset.findUnique({ where: { id: "stock-asset" } }),
      ).resolves.not.toBeNull();

      const created = await createProjectFromPlan(
        {
          projectName: "Automatic stock",
          scriptName: "Created",
          scenes: [
            {
              text: "Ocean scene",
              templateId: "kinetic",
              emphasis: [],
              backgroundQuery: "ocean waves",
              mediaKind: "image",
            },
          ],
        },
        "portrait",
        [
          {
            type: "image",
            url: "/media/stock-media/test.jpg",
            effect: "ken-burns",
          },
        ],
        "remotion",
        undefined,
        {
          mediaPreferences: ["image"],
          stockSelections: [snapshot],
        },
      );
      const automaticScene = await prisma.scene.findFirstOrThrow({
        where: { scriptId: created.scriptId },
        include: { stockMediaSelection: true },
      });
      expect(JSON.parse(automaticScene.layoutJson!)).toMatchObject({
        mediaPreference: "image",
        background: { type: "image" },
      });
      expect(automaticScene.stockMediaSelection?.providerAssetId).toBe("42");
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
