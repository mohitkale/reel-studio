// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  inspectAndBackup,
  schemaSignature,
} from "../../scripts/migrate-database.mjs";
import { databaseUrl } from "../../scripts/database-url.mjs";
import { createPrismaClient } from "./prisma-client";
import { resolvedStockAssetSchema } from "@/providers/stock/schemas";

vi.setConfig({ testTimeout: 15_000 });

describe("SQLite migration preparation", () => {
  it("recognizes equivalent schemas when db push appended columns", () => {
    const first = new DatabaseSync(":memory:");
    const second = new DatabaseSync(":memory:");
    try {
      first.exec(
        "CREATE TABLE Sample (id TEXT PRIMARY KEY, label TEXT, count INTEGER)",
      );
      second.exec(
        "CREATE TABLE Sample (id TEXT PRIMARY KEY, count INTEGER, label TEXT)",
      );
      expect(schemaSignature(first)).toBe(schemaSignature(second));
    } finally {
      first.close();
      second.close();
    }
  });
  it("preserves legacy relative URL resolution", () => {
    expect(databaseUrl("file:./dev.db")).toBe(
      `file:${path.resolve("prisma/dev.db")}`,
    );
  });
  it("recognizes a populated legacy database and preserves its rows in backup", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-migration-"));
    try {
      const filename = path.join(directory, "legacy.db");
      const db = new DatabaseSync(filename);
      db.exec(
        readFileSync(
          "prisma/migrations/20260910000100_baseline/migration.sql",
          "utf8",
        ),
      );
      db.exec(
        "INSERT INTO Project (id,name,updatedAt) VALUES ('saved','Existing project',CURRENT_TIMESTAMP)",
      );
      db.close();
      const result = inspectAndBackup(filename);
      expect(result.needsBaseline).toBe(true);
      const restored = new DatabaseSync(result.backup!);
      expect(
        restored.prepare("SELECT name FROM Project WHERE id='saved'").get()
          ?.name,
      ).toBe("Existing project");
      restored.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("rejects unknown schema without modifying it", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-drift-"));
    try {
      const filename = path.join(directory, "drift.db");
      const db = new DatabaseSync(filename);
      db.exec("CREATE TABLE Unknown (id INTEGER)");
      db.close();
      expect(() => inspectAndBackup(filename)).toThrow(
        "Unrecognized SQLite schema",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("allows a fresh database", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-fresh-"));
    try {
      expect(
        inspectAndBackup(path.join(directory, "new.db")).needsBaseline,
      ).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("reads legacy dates and writes through the upgraded Prisma adapter", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-adapter-"));
    const previous = process.env.DATABASE_URL;
    const filename = path.join(directory, "adapter.db");
    const db = new DatabaseSync(filename);
    db.exec(
      readFileSync(
        "prisma/migrations/20260910000100_baseline/migration.sql",
        "utf8",
      ),
    );
    db.exec(
      "INSERT INTO Project (id,name,updatedAt) VALUES ('legacy','Saved before upgrade','2026-08-06T10:00:00.000Z')",
    );
    db.close();
    process.env.DATABASE_URL = `file:${filename}`;
    const client = createPrismaClient();
    try {
      const legacy = await client.project.findUniqueOrThrow({
        where: { id: "legacy" },
      });
      expect(legacy.updatedAt.toISOString()).toBe("2026-08-06T10:00:00.000Z");
      const created = await client.project.create({
        data: { name: "New project" },
      });
      expect(created.videoEngine).toBe("hyperframes");
      expect(await client.project.count()).toBe(2);
    } finally {
      await client.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("adds caption tracks to a populated installation without changing projects", async () => {
    const directory = mkdtempSync(
      path.join(tmpdir(), "reel-caption-migration-"),
    );
    const previous = process.env.DATABASE_URL;
    const filename = path.join(directory, "captions.db");
    const db = new DatabaseSync(filename);
    db.exec(
      readFileSync(
        "prisma/migrations/20260910000100_baseline/migration.sql",
        "utf8",
      ),
    );
    db.exec(
      "INSERT INTO Project (id,name,updatedAt) VALUES ('saved','Existing project',CURRENT_TIMESTAMP)",
    );
    db.exec(
      "INSERT INTO Script (id,projectId,name,updatedAt) VALUES ('script','saved','Existing script',CURRENT_TIMESTAMP)",
    );
    db.exec(
      readFileSync(
        "prisma/migrations/20260912000100_caption_tracks/migration.sql",
        "utf8",
      ),
    );
    db.close();
    process.env.DATABASE_URL = `file:${filename}`;
    const client = createPrismaClient();
    try {
      await client.captionTrack.create({
        data: {
          scriptId: "script",
          label: "Imported",
          timingSource: "imported",
          cues: {
            create: {
              order: 0,
              startFrame: 0,
              endFrame: 30,
              text: "Preserved captions",
            },
          },
        },
      });
      expect(
        await client.project.findUnique({ where: { id: "saved" } }),
      ).toMatchObject({
        name: "Existing project",
      });
      expect(
        await client.captionCue.findFirst({
          where: { track: { scriptId: "script" } },
        }),
      ).toMatchObject({ text: "Preserved captions", endFrame: 30 });
    } finally {
      await client.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("adds podcast turn caching and MP3 metadata without changing saved takes", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        readFileSync(
          "prisma/migrations/20260910000100_baseline/migration.sql",
          "utf8",
        ),
      );
      db.exec(`
        INSERT INTO Podcast (id,title,updatedAt) VALUES ('podcast','Saved episode',CURRENT_TIMESTAMP);
        INSERT INTO PodcastCharacter (id,podcastId,key,name,"order",updatedAt)
          VALUES ('host','podcast','host','Host',0,CURRENT_TIMESTAMP);
        INSERT INTO PodcastTurn (id,podcastId,characterId,"order",text,updatedAt)
          VALUES ('turn','podcast','host',0,'Existing line',CURRENT_TIMESTAMP);
        INSERT INTO PodcastTake (id,podcastId,providerId,voiceId,totalFrames,timingJson,audioPath)
          VALUES ('take','podcast','kokoro-server','af_bella',30,'[]','podcast-takes/existing.wav');
      `);
      db.exec(
        readFileSync(
          "prisma/migrations/20260912000200_audio_production/migration.sql",
          "utf8",
        ),
      );
      expect(
        db
          .prepare("SELECT audioPath, mp3Path FROM PodcastTake WHERE id='take'")
          .get(),
      ).toEqual({
        audioPath: "podcast-takes/existing.wav",
        mp3Path: null,
      });
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='PodcastTurnAudioBeat'",
          )
          .get()?.count,
      ).toBe(1);
    } finally {
      db.close();
    }
  });

  it("adds podcast formats and chapter snapshots without restyling saved episodes", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        readFileSync(
          "prisma/migrations/20260910000100_baseline/migration.sql",
          "utf8",
        ),
      );
      db.exec(`
        INSERT INTO Podcast (id,title,updatedAt) VALUES ('podcast','Saved episode',CURRENT_TIMESTAMP);
        INSERT INTO PodcastTake (id,podcastId,providerId,voiceId,totalFrames,timingJson,audioPath)
          VALUES ('take','podcast','kokoro-server','af_bella',30,'[]','podcast-takes/existing.wav');
      `);
      db.exec(
        readFileSync(
          "prisma/migrations/20260912000200_audio_production/migration.sql",
          "utf8",
        ),
      );
      db.exec(
        readFileSync(
          "prisma/migrations/20260912000300_podcast_production/migration.sql",
          "utf8",
        ),
      );
      expect(
        db.prepare("SELECT presetId FROM Podcast WHERE id='podcast'").get(),
      ).toEqual({ presetId: "two-host-discussion" });
      expect(
        db
          .prepare("SELECT chaptersJson FROM PodcastTake WHERE id='take'")
          .get(),
      ).toEqual({ chaptersJson: "[]" });
    } finally {
      db.close();
    }
  });

  it("adds podcast finishing controls without changing saved episodes or takes", () => {
    const db = new DatabaseSync(":memory:");
    try {
      for (const migration of [
        "20260910000100_baseline",
        "20260912000200_audio_production",
        "20260912000300_podcast_production",
      ]) {
        db.exec(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
      }
      db.exec(`
        INSERT INTO Podcast (id,title,updatedAt) VALUES ('podcast','Saved episode',CURRENT_TIMESTAMP);
        INSERT INTO PodcastCharacter (id,podcastId,key,name,"order",updatedAt)
          VALUES ('host','podcast','host','Host',0,CURRENT_TIMESTAMP);
        INSERT INTO PodcastTurn (id,podcastId,characterId,"order",text,updatedAt)
          VALUES ('turn','podcast','host',0,'Existing line',CURRENT_TIMESTAMP);
        INSERT INTO PodcastTake (id,podcastId,providerId,voiceId,totalFrames,timingJson,audioPath)
          VALUES ('take','podcast','kokoro-server','af_bella',30,'[]','podcast-takes/existing.wav');
      `);
      db.exec(
        readFileSync(
          "prisma/migrations/20260914000100_podcast_finishing/migration.sql",
          "utf8",
        ),
      );
      expect(
        db
          .prepare(
            "SELECT introMusicAssetId, outroMusicAssetId, pronunciationsJson FROM Podcast WHERE id='podcast'",
          )
          .get(),
      ).toEqual({
        introMusicAssetId: null,
        outroMusicAssetId: null,
        pronunciationsJson: "[]",
      });
      expect(
        db
          .prepare("SELECT pauseAfterSeconds FROM PodcastTurn WHERE id='turn'")
          .get(),
      ).toEqual({ pauseAfterSeconds: null });
      expect(
        db
          .prepare("SELECT finishingJson FROM PodcastTake WHERE id='take'")
          .get(),
      ).toEqual({ finishingJson: "{}" });
    } finally {
      db.close();
    }
  });

  it("backfills existing Unsplash backgrounds without changing their render data", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        readFileSync(
          "prisma/migrations/20260910000100_baseline/migration.sql",
          "utf8",
        ),
      );
      const hotlink =
        "https://images.unsplash.com/photo-123?crop=entropy&ixid=keep-me&w=1080";
      const legacyHotlink =
        "https://plus.unsplash.com/premium_photo-456?ixid=keep-legacy";
      db.prepare(
        "INSERT INTO Project (id,name,updatedAt) VALUES ('saved','Existing project',CURRENT_TIMESTAMP)",
      ).run();
      db.prepare(
        "INSERT INTO Script (id,projectId,name,width,height,updatedAt) VALUES ('script','saved','Existing script',1920,1080,CURRENT_TIMESTAMP)",
      ).run();
      db.prepare(
        "INSERT INTO Scene (id,scriptId,\"order\",text,layoutJson,updatedAt) VALUES ('layout','script',0,'Layout background',?,CURRENT_TIMESTAMP)",
      ).run(JSON.stringify({ background: { type: "image", url: hotlink } }));
      db.prepare(
        "INSERT INTO Scene (id,scriptId,\"order\",text,visual,updatedAt) VALUES ('visual','script',1,'Legacy visual',?,CURRENT_TIMESTAMP)",
      ).run(JSON.stringify({ url: legacyHotlink, effect: "ken-burns" }));

      db.exec(
        readFileSync(
          "prisma/migrations/20260914000200_stock_media_schema/migration.sql",
          "utf8",
        ),
      );

      const selections = db
        .prepare(
          "SELECT sceneId, snapshotJson FROM StockMediaSelection ORDER BY sceneId",
        )
        .all() as Array<{ sceneId: string; snapshotJson: string }>;
      expect(selections).toHaveLength(2);
      for (const selection of selections) {
        const snapshot = resolvedStockAssetSchema.parse(
          JSON.parse(selection.snapshotJson),
        );
        expect(snapshot.providerSnapshot.providerId).toBe("unsplash");
        expect(snapshot.providerSnapshot.acquisitionPolicy).toBe("hotlink");
        expect(snapshot.compliantRemoteUrl).toContain("ixid=keep-");
        expect(snapshot.providerSnapshot.orientation).toBe("landscape");
      }
      expect(
        db.prepare("SELECT layoutJson FROM Scene WHERE id='layout'").get(),
      ).toEqual({
        layoutJson: JSON.stringify({
          background: { type: "image", url: hotlink },
        }),
      });
      expect(
        db.prepare("SELECT visual FROM Scene WHERE id='visual'").get(),
      ).toEqual({
        visual: JSON.stringify({ url: legacyHotlink, effect: "ken-burns" }),
      });
    } finally {
      db.close();
    }
  });

  it("adds stock response cache, quota, and materialization state", () => {
    const db = new DatabaseSync(":memory:");
    try {
      for (const migration of [
        "20260910000100_baseline",
        "20260914000200_stock_media_schema",
        "20260914000300_stock_media_services",
      ]) {
        db.exec(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
      }
      db.exec(`
        INSERT INTO Asset (id,type,path) VALUES ('asset','image','stock-media/hash.png');
        INSERT INTO StockMediaResponseCache (requestHash,providerId,operation,requestJson,responseJson,expiresAt,updatedAt)
          VALUES ('request','fixture','search','{}','{"items":[]}','2026-09-15T00:00:00.000Z',CURRENT_TIMESTAMP);
        INSERT INTO StockMediaQuotaState (providerId,"limit",remaining,observedAt,updatedAt)
          VALUES ('fixture',100,99,'2026-09-14T14:30:00.000Z',CURRENT_TIMESTAMP);
        INSERT INTO StockMediaMaterialization (requestHash,providerId,providerAssetId,renditionId,sourceUrl,assetId,contentHash,metadataJson,updatedAt)
          VALUES ('materialized','fixture','photo-1','large','https://cdn.example.test/photo.png','asset','${"a".repeat(64)}','{}',CURRENT_TIMESTAMP);
      `);
      expect(
        db
          .prepare(
            "SELECT providerId, remaining FROM StockMediaQuotaState WHERE providerId='fixture'",
          )
          .get(),
      ).toEqual({ providerId: "fixture", remaining: 99 });
      expect(
        db
          .prepare(
            "SELECT assetId FROM StockMediaMaterialization WHERE requestHash='materialized'",
          )
          .get(),
      ).toEqual({ assetId: "asset" });
    } finally {
      db.close();
    }
  });

  it("backs up and restores a populated 0.4 database with durable stage outputs", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-pr1-populated-"));
    const filename = path.join(directory, "populated.db");
    try {
      const db = new DatabaseSync(filename);
      for (const migration of readdirSync("prisma/migrations")
        .filter((name) => !name.endsWith(".toml"))
        .sort())
        db.exec(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
      db.exec(`CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY);
        INSERT INTO Project (id,name,videoEngine,updatedAt) VALUES ('saved','Saved project','remotion',CURRENT_TIMESTAMP);
        INSERT INTO Script (id,projectId,name,updatedAt) VALUES ('script','saved','Saved script',CURRENT_TIMESTAMP);
        INSERT INTO ProductionJob (id,kind,state,idempotencyKey,inputSnapshot,updatedAt) VALUES ('job','video','failed','saved-request','{"scriptId":"script"}',CURRENT_TIMESTAMP);
        INSERT INTO ProductionJobStep (id,jobId,key,state,cacheKey,detailJson,updatedAt) VALUES ('step','job','plan','succeeded','saved-cache','{"revision":1}',CURRENT_TIMESTAMP);`);
      const signature = schemaSignature(db);
      db.close();
      const backup = inspectAndBackup(filename);
      expect(backup.needsBaseline).toBe(false);
      const restored = new DatabaseSync(backup.backup!);
      try {
        expect(schemaSignature(restored)).toBe(signature);
        expect(
          restored
            .prepare("SELECT name,videoEngine FROM Project WHERE id='saved'")
            .get(),
        ).toEqual({ name: "Saved project", videoEngine: "remotion" });
        expect(
          restored
            .prepare(
              "SELECT cacheKey,detailJson FROM ProductionJobStep WHERE id='step'",
            )
            .get(),
        ).toEqual({ cacheKey: "saved-cache", detailJson: '{"revision":1}' });
      } finally {
        restored.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
