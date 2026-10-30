// @vitest-environment node
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";

import { scenePlanSchema } from "@/providers/ai/types";
import { editorialCreationRequestSchema } from "@/production/editorial";
import { evidenceFixture } from "@/research/fixtures";
const m = vi.hoisted(() => ({
  db: null as PrismaClient | null,
  generate: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("@/library/db", () => ({
  get prisma() {
    return m.db!;
  },
}));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider: () => ({ isConfigured: () => true, generatePlan: m.generate }),
  listAIProviderStatuses: async () => [
    { id: "ollama", defaultModel: "fixture-writer" },
  ],
}));
import {
  startEditorialWriting,
  runEditorialWriting,
  controlEditorialWriting,
} from "./editorial-writing";
import { readEditorialRecord } from "./repositories/editorial";
import { importExternalEvidence } from "./research-import";
import { controlEditorialStoryboard } from "./editorial-storyboard";
import { moveSceneHistory } from "./scene-history";
import { captureVideoSnapshot } from "./video-snapshot";
vi.setConfig({ testTimeout: 15_000, hookTimeout: 20_000 });
const root = mkdtempSync(path.join(tmpdir(), "reel-editorial-"));
let previous: string | undefined;
beforeAll(async () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  await backup(db, path.join(root, "editorial.db"));
  db.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${path.join(root, "editorial.db")}`;
  m.db = createPrismaClient();
});
afterAll(async () => {
  await m.db?.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(root, { recursive: true, force: true });
});
const request = (key = "editorial-001") =>
  editorialCreationRequestSchema.parse({
    idempotencyKey: key,
    brief: "A local-first editor.",
    creativeBrief: {
      intent: "explainer",
      audience: "New creators",
      goal: "Explain a local workflow",
      language: "English",
      tone: "Plain",
      targetSeconds: 30,
      takeaway: "Review sources before publishing",
    },
    providerId: "ollama",
    budget: { maxProviderCalls: 1, deadlineMs: 10000 },
  });
const plan = () =>
  scenePlanSchema.parse({
    projectName: "A local workflow",
    scriptName: "Local creation",
    scenes: [
      {
        templateId: "hf-statement",
        text: "Work locally",
        spokenText: "A local-first editor.",
        evidenceRefs: [{ sourceId: "source-1", excerptId: "excerpt-1" }],
        emphasis: [],
      },
    ],
  });
beforeEach(async () => {
  vi.clearAllMocks();
  m.generate.mockResolvedValue(plan());
  m.authorize.mockResolvedValue(undefined);
  await m.db!.project.deleteMany();
  await m.db!.evidenceRevision.deleteMany();
});
it("caches source-linked shots, preserves narration, applies atomically and freezes editorial provenance", async () => {
  const evidence = await importExternalEvidence(evidenceFixture());
  const input = { ...request(), evidenceId: evidence.id };
  input.creativeBrief.intent = "product";
  const created = await startEditorialWriting(input);
  await runEditorialWriting(created.scriptId, m.authorize);
  const compile = {
    action: "compile" as const,
    expectedRevision: 1,
    budget: { maxProviderCalls: 0 as const },
  };
  const cache = await controlEditorialStoryboard(created.scriptId, compile);
  expect(cache.shots[0]).toMatchObject({
    narration: "A local-first editor.",
    references: [{ sourceId: "source-1", excerptId: "excerpt-1" }],
  });
  expect(cache.shots[0].assetNeeds.join(" ")).toContain("real product");
  expect(cache.plan.scenes[0].backgroundQuery).toBeUndefined();
  expect(await controlEditorialStoryboard(created.scriptId, compile)).toEqual(
    cache,
  );
  await controlEditorialStoryboard(created.scriptId, {
    action: "cancel",
    expectedHash: cache.sourceHash,
  });
  await expect(
    controlEditorialStoryboard(created.scriptId, {
      action: "apply",
      expectedHash: cache.sourceHash,
    }),
  ).rejects.toMatchObject({ status: 409 });
  const resumed = await controlEditorialStoryboard(created.scriptId, compile);
  await controlEditorialStoryboard(created.scriptId, {
    action: "apply",
    expectedHash: resumed.sourceHash,
  });
  expect((await m.db!.scene.findMany())[0]).toMatchObject({
    text: "Work locally",
    spokenText: "A local-first editor.",
  });
  expect(m.generate).toHaveBeenCalledOnce();
  const snapshot = await captureVideoSnapshot(created.scriptId);
  expect(snapshot.script.editorialWorkflow?.draft?.beats[0].narration).toBe(
    "A local-first editor.",
  );
  expect(snapshot.script.editorialStoryboard?.state).toBe("applied");
  expect(snapshot.script.researchEvidence?.id).toBe(evidence.id);
  await moveSceneHistory(created.scriptId, "undo");
  expect(await m.db!.scene.count()).toBe(0);
});
it("invalidates edited scripts and stale previews while honoring copy and scene locks", async () => {
  const fixture = plan();
  fixture.scenes[0].evidenceRefs = [];
  m.generate.mockResolvedValue(fixture);
  const created = await startEditorialWriting(request());
  await runEditorialWriting(created.scriptId, m.authorize);
  const compile = {
    action: "compile" as const,
    expectedRevision: 1,
    budget: { maxProviderCalls: 0 as const },
  };
  const first = await controlEditorialStoryboard(created.scriptId, compile);
  const draft = (await readEditorialRecord(created.scriptId))!.workflow.draft!;
  draft.beats[0].narration = "Review the real local workflow.";
  await controlEditorialWriting(created.scriptId, {
    action: "save",
    expectedRevision: 1,
    draft,
  });
  await expect(
    controlEditorialStoryboard(created.scriptId, {
      action: "apply",
      expectedHash: first.sourceHash,
    }),
  ).rejects.toMatchObject({ status: 409 });
  const second = await controlEditorialStoryboard(created.scriptId, {
    ...compile,
    expectedRevision: 2,
  });
  expect(second.inputHash).not.toBe(first.inputHash);
  await controlEditorialStoryboard(created.scriptId, {
    action: "apply",
    expectedHash: second.sourceHash,
  });
  const scene = (await m.db!.scene.findMany())[0];
  await m.db!.scene.update({
    where: { id: scene.id },
    data: {
      text: "Protected copy",
      layoutJson: JSON.stringify({
        locks: { copy: true, scene: false, assets: false },
      }),
    },
  });
  const third = await controlEditorialStoryboard(created.scriptId, {
    ...compile,
    expectedRevision: 2,
  });
  await m.db!.scene.update({
    where: { id: scene.id },
    data: { text: "Changed after preview" },
  });
  await expect(
    controlEditorialStoryboard(created.scriptId, {
      action: "apply",
      expectedHash: third.sourceHash,
    }),
  ).rejects.toMatchObject({ status: 409 });
  const fourth = await controlEditorialStoryboard(created.scriptId, {
    ...compile,
    expectedRevision: 2,
  });
  await controlEditorialStoryboard(created.scriptId, {
    action: "apply",
    expectedHash: fourth.sourceHash,
  });
  expect(
    (await m.db!.scene.findUniqueOrThrow({ where: { id: scene.id } })).text,
  ).toBe("Changed after preview");
  await m.db!.scene.create({
    data: {
      scriptId: created.scriptId,
      text: "Extra locked scene",
      templateId: "hf-statement",
      order: 1,
      layoutJson: JSON.stringify({
        locks: { scene: true, copy: false, assets: false },
      }),
    },
  });
  const last = await controlEditorialStoryboard(created.scriptId, {
    ...compile,
    expectedRevision: 2,
  });
  await expect(
    controlEditorialStoryboard(created.scriptId, {
      action: "apply",
      expectedHash: last.sourceHash,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.generate).toHaveBeenCalledOnce();
});
it.each([true, false])(
  "admits approved screen-copy charts only from literal supplied rows (%s)",
  async (supported) => {
    const fixture = plan();
    fixture.scenes[0].text = "Draft: 42%\nReview: 68%";
    fixture.scenes[0].spokenText =
      "Compare the supplied values; this is a synthetic example.";
    fixture.scenes[0].evidenceRefs = [];
    m.generate.mockResolvedValueOnce(fixture);
    const input = request();
    input.creativeBrief.intent = "data";
    input.brief = supported
      ? "Draft: 42%\nReview: 68%"
      : "Values include 42% and 68%, with no labeled dataset.";
    const created = await startEditorialWriting(input);
    await runEditorialWriting(created.scriptId, m.authorize);
    const cache = await controlEditorialStoryboard(created.scriptId, {
      action: "compile",
      expectedRevision: 1,
      budget: { maxProviderCalls: 0 },
    });
    if (supported)
      expect(cache.plan.scenes[0].chart?.series[0].values).toEqual([42, 68]);
    else expect(cache.plan.scenes[0].chart).toBeUndefined();
    expect(cache.plan.scenes[0].spokenText).toBe(fixture.scenes[0].spokenText);
  },
);
