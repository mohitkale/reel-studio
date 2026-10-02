// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AutomaticMediaDecision } from "./automatic-stock-media";
import { chapterPlanIssue } from "@/production/chapters";
const previousUrl = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;
  vi.resetModules();
});
// Real SQLite migrations, lazy service imports and transaction races need a
// bounded integration budget on shared CI runners, separate from unit defaults.
it("atomically appends chapters and stock, preserves prior work, and rejects races, failed metadata and canceled writes", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-chapter-append-"));
  const filename = path.join(directory, "append.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  db.close();
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const { captureSceneRewriteState } =
      await import("./scene-rewrite-service");
    const { commitSceneAppend } = await import("./scene-append-service");
    const { getScript } = await import("./repositories/scripts");
    const plan = {
      version: "1.0.0",
      chapters: [
        { id: "chapter:1", title: "Question", firstSceneId: "scene-0" },
        { id: "chapter:2", title: "Proof", firstSceneId: "scene-20" },
      ],
    };
    await prisma.project.create({
      data: {
        id: "project",
        name: "Chapters",
        scripts: {
          create: {
            id: "script",
            name: "Full story",
            brandOverrides: JSON.stringify({
              chapterPlan: plan,
              customBrandField: "retained",
              audioMastering: "balanced",
            }),
            scenes: {
              create: Array.from({ length: 24 }, (_, index) => ({
                id: `scene-${index}`,
                order: index * 2,
                templateId: "kinetic",
                text: `Original ${index}`,
                spokenText: `Voice ${index}`,
                assetRefs: JSON.stringify(["asset"]),
                layoutJson: JSON.stringify({
                  locks: { scene: true, assets: true, copy: true },
                }),
              })),
            },
          },
        },
      },
    });
    await prisma.asset.create({
      data: {
        id: "stock-asset",
        type: "image",
        name: "Stock",
        path: "test.jpg",
      },
    });
    const rendition = {
      id: "portrait",
      url: "https://images.example.test/photo.jpg",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    };
    const selected: AutomaticMediaDecision = {
      state: "selected",
      attemptedProviders: ["pexels"],
      message: "Selected",
      background: { type: "image", url: "/media/test.jpg" },
      snapshot: {
        schemaVersion: 1,
        resolvedAt: "2026-09-30T01:00:00.000Z",
        contentHash: "a".repeat(64),
        localAssetId: "stock-asset",
        providerSnapshot: {
          providerId: "pexels",
          providerAssetId: "42",
          kind: "image",
          creator: "Creator",
          sourcePageUrl: "https://www.pexels.com/photo/42/",
          previewUrl: rendition.url,
          width: 1080,
          height: 1920,
          orientation: "portrait",
          mimeType: "image/jpeg",
          renderRenditions: [rendition],
          attribution: { text: "Photo by Creator", required: true },
          acquisitionPolicy: "download",
        },
        selectedRendition: rendition,
        sourceRevision: {
          capturedAt: "2026-09-30T01:00:00.000Z",
          termsUrl: "https://www.pexels.com/license/",
        },
        usageEvent: { state: "not-required" },
      },
    };
    const generated = [
      {
        templateId: "kinetic",
        text: "New opening",
        layoutJson: JSON.stringify({ background: selected.background }),
      },
      { templateId: "kinetic", text: "New takeaway" },
    ];
    const disabled: AutomaticMediaDecision = {
      state: "disabled",
      attemptedProviders: [],
      message: "Disabled",
    };
    const before = (await getScript("script"))!;
    const input = {
      scriptId: "script",
      expectedState: await captureSceneRewriteState("script"),
      chapterTitle: "Next",
      scenes: generated,
      mediaDecisions: [selected, disabled],
    };
    const ids = await commitSceneAppend(input);
    const after = (await getScript("script"))!;
    expect(after.scenes.slice(0, 24)).toEqual(before.scenes);
    expect(after.scenes.slice(24).map((scene) => scene.id)).toEqual(ids);
    expect(after.scenes.slice(24).map((scene) => scene.order)).toEqual([
      47, 48,
    ]);
    expect(after.chapterPlan!.chapters.slice(0, 2)).toEqual(plan.chapters);
    expect(after.chapterPlan!.chapters[2]).toMatchObject({
      title: "Next",
      firstSceneId: ids[0],
    });
    expect(
      new Set(after.chapterPlan!.chapters.map((chapter) => chapter.id)).size,
    ).toBe(3);
    expect(
      chapterPlanIssue(
        after.chapterPlan!,
        after.scenes.map((scene) => scene.id),
      ),
    ).toBeUndefined();
    const saved = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
    });
    expect(JSON.parse(saved.brandOverrides!)).toMatchObject({
      customBrandField: "retained",
      audioMastering: "balanced",
    });
    const stock = await prisma.stockMediaSelection.findUniqueOrThrow({
      where: { sceneId: ids[0] },
    });
    expect(stock.providerAssetId).toBe("42");
    expect(JSON.parse(stock.snapshotJson)).toEqual(selected.snapshot);
    await expect(commitSceneAppend(input)).rejects.toMatchObject({
      status: 409,
    });
    // Extending the last chapter keeps all chapter IDs/titles/boundaries.
    await commitSceneAppend({
      ...input,
      chapterTitle: undefined,
      expectedState: await captureSceneRewriteState("script"),
      mediaDecisions: [disabled, disabled],
    });
    expect((await getScript("script"))!.chapterPlan).toEqual(after.chapterPlan);
    for (const change of [
      () =>
        prisma.scene.update({
          where: { id: "scene-0" },
          data: { text: "Human edit" },
        }),
      () =>
        prisma.scene.update({
          where: { id: "scene-0" },
          data: { layoutJson: JSON.stringify({ locks: { scene: false } }) },
        }),
      () =>
        prisma.scene.update({ where: { id: "scene-23" }, data: { order: 99 } }),
      () =>
        prisma.script.update({
          where: { id: "script" },
          data: {
            brandOverrides: JSON.stringify({
              chapterPlan: {
                ...after.chapterPlan,
                chapters: after.chapterPlan!.chapters.map((chapter) => ({
                  ...chapter,
                  title: "Changed",
                })),
              },
            }),
          },
        }),
      () =>
        prisma.scene.create({
          data: { scriptId: "script", order: 100, text: "Manual addition" },
        }),
      () => prisma.scene.delete({ where: { id: "scene-1" } }),
      () =>
        prisma.project.update({
          where: { id: "project" },
          data: { videoEngine: "retired-engine" },
        }),
    ]) {
      const expectedState = await captureSceneRewriteState("script");
      await change();
      const frozen = await prisma.script.findUniqueOrThrow({
        where: { id: "script" },
        include: { scenes: true },
      });
      await expect(
        commitSceneAppend({ ...input, expectedState }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await prisma.script.findUniqueOrThrow({
          where: { id: "script" },
          include: { scenes: true },
        }),
      ).toEqual(frozen);
    }
    // Repair outline after intentional order/delete races, then fail *inside* the transaction.
    await prisma.script.update({
      where: { id: "script" },
      data: {
        brandOverrides: JSON.stringify({
          chapterPlan: {
            version: "1.0.0",
            chapters: [
              { id: "first", title: "First", firstSceneId: "scene-0" },
              { id: "second", title: "Second", firstSceneId: "scene-21" },
            ],
          },
        }),
      },
    });
    const frozen = await prisma.script.findUniqueOrThrow({
      where: { id: "script" },
      include: { scenes: true },
    });
    const stockCount = await prisma.stockMediaSelection.count();
    await expect(
      commitSceneAppend({
        ...input,
        expectedState: await captureSceneRewriteState("script"),
        mediaDecisions: [
          selected,
          {
            ...selected,
            snapshot: { ...selected.snapshot!, localAssetId: "missing" },
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await prisma.script.findUniqueOrThrow({
        where: { id: "script" },
        include: { scenes: true },
      }),
    ).toEqual(frozen);
    expect(await prisma.stockMediaSelection.count()).toBe(stockCount);
    const cancel = new AbortController();
    cancel.abort();
    await expect(
      commitSceneAppend({ ...input, signal: cancel.signal }),
    ).rejects.toMatchObject({ status: 499 });
    await expect(
      commitSceneAppend({ ...input, scenes: [] }),
    ).rejects.toMatchObject({ status: 502 });
    // A second generation with the same captured draft cannot append again.
    const expectedState = await captureSceneRewriteState("script");
    const results = await Promise.allSettled([
      commitSceneAppend({ ...input, expectedState }),
      commitSceneAppend({ ...input, expectedState }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { status: 409 } });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
