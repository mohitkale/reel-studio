// @vitest-environment node
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";

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
import {
  startMediaRanking,
  runMediaRanking,
  readMediaRanking,
  mediaRankingSource,
} from "./media-ranking-service";
import { controlMediaRankingJob } from "./repositories/media-ranking-jobs";
import { mediaVisionRequestSchema } from "@/production/media-vision";
import { stockMediaCandidateSchema } from "@/providers/stock/schemas";
import type { StockMediaProviderRegistry } from "@/providers/stock/registry";
import { applyStockMediaSelection } from "./repositories/stock-media-selections";
import { rankingForSelection } from "./media-ranking-selection";
vi.setConfig({ testTimeout: 15_000, hookTimeout: 20_000 });
const root = mkdtempSync(path.join(tmpdir(), "reel-media-ranking-"));
let previous: string | undefined;
beforeAll(async () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  await backup(db, path.join(root, "media-ranking.db"));
  db.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${path.join(root, "media-ranking.db")}`;
  m.db = createPrismaClient();
});
afterAll(async () => {
  await m.db?.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(root, { recursive: true, force: true });
});
const candidate = stockMediaCandidateSchema.parse({
  providerId: "pexels",
  providerAssetId: "one",
  kind: "image",
  previewUrl: "https://images.example.test/one.jpg",
  sourcePageUrl: "https://example.test/one",
  creator: "Fixture",
  description: "Calm ocean blue",
  width: 1080,
  height: 1920,
  orientation: "portrait",
  renderRenditions: [
    {
      id: "full",
      url: "https://images.example.test/one.jpg",
      width: 1080,
      height: 1920,
    },
  ],
  attribution: { text: "Fixture", required: true },
  acquisitionPolicy: "download",
});
const scores = [
  {
    candidateId: "pexels:one",
    relevance: 0.9,
    textSpace: 0.8,
    styleTags: ["calm"],
    reason: "Clear text space",
  },
];
const registry = {
  search: vi.fn(async () => ({ items: [candidate] })),
} as unknown as StockMediaProviderRegistry;
const dependencies = { registry, score: m.generate, configured: () => true };
beforeEach(async () => {
  vi.clearAllMocks();
  await m.db!.project.deleteMany();
  m.generate.mockResolvedValue(scores);
  m.authorize.mockResolvedValue(undefined);
});
async function setup(key = "vision-request-1") {
  const project = await m.db!.project.create({
    data: {
      name: "Ranking fixture",
      scripts: {
        create: {
          name: "Fixture",
          scenes: {
            create: [
              {
                text: "Ocean conservation",
                spokenText: "Protect ocean habitats.",
                templateId: "hf-statement",
                order: 0,
              },
              { text: "Keep sources", templateId: "hf-statement", order: 1 },
            ],
          },
        },
      },
    },
    include: { scripts: { include: { scenes: true } } },
  });
  const script = project.scripts[0],
    scene = script.scenes.find((s) => s.order === 0)!,
    hash = (await mediaRankingSource(script.id)).sourceHash;
  const input = mediaVisionRequestSchema.parse({
    idempotencyKey: key,
    expectedHash: hash,
    sceneId: scene.id,
    stockProviderId: "pexels",
    search: { query: "ocean", kind: "image", orientation: "portrait" },
    candidateIds: ["one"],
    modelId: "fixture-vision",
    budget: { maxProviderCalls: 1, maxImages: 6, deadlineMs: 10000 },
  });
  return { scriptId: script.id, scene, input };
}
it("persists a single explicit call across reconnects, caches ranked alternatives and never changes scenes", async () => {
  const { scriptId, scene, input } = await setup();
  const [first, reconnected] = await Promise.all([
    startMediaRanking(scriptId, input),
    startMediaRanking(scriptId, input),
  ]);
  expect(reconnected).toEqual(first);
  await runMediaRanking(scriptId, first.id, m.authorize, dependencies);
  const current = await readMediaRanking(scriptId, first.id);
  expect(current.job).toMatchObject({
    state: "ready",
    callsUsed: 1,
    assessments: scores,
  });
  await runMediaRanking(scriptId, first.id, m.authorize, dependencies);
  expect(m.generate).toHaveBeenCalledOnce();
  expect(m.authorize).toHaveBeenCalledOnce();
  expect(
    await m.db!.scene.findUniqueOrThrow({ where: { id: scene.id } }),
  ).toEqual(scene);
  const selection = await rankingForSelection(
    scene.id,
    first.id,
    "pexels",
    input.search,
    [candidate],
    "one",
  );
  expect(selection.ranking.method).toBe("metadata+vision");
  await expect(
    startMediaRanking(scriptId, { ...input, modelId: "changed" }),
  ).rejects.toMatchObject({ status: 409 });
  await m.db!.scene.update({
    where: { id: scene.id },
    data: { text: "Changed" },
  });
  await expect(
    rankingForSelection(
      scene.id,
      first.id,
      "pexels",
      input.search,
      [candidate],
      "one",
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it("cancels running work without late results or paid replay", async () => {
  const { scriptId, input } = await setup();
  let finish: (v: typeof scores) => void = () => {};
  m.generate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const job = await startMediaRanking(scriptId, input),
    running = runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  await vi.waitFor(() => expect(m.generate).toHaveBeenCalledOnce());
  await controlMediaRankingJob(scriptId, job.id, "cancel");
  finish(scores);
  await running;
  expect((await readMediaRanking(scriptId, job.id)).job).toMatchObject({
    state: "canceled",
    callsUsed: 1,
    assessments: [],
  });
  await controlMediaRankingJob(scriptId, job.id, "resume");
  await runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  expect(m.generate).toHaveBeenCalledOnce();
});
it("resumes unspent work but rejects stale or protected scopes before generation", async () => {
  const { scriptId, scene, input } = await setup();
  const job = await startMediaRanking(scriptId, input);
  await controlMediaRankingJob(scriptId, job.id, "cancel");
  await controlMediaRankingJob(scriptId, job.id, "resume");
  await m.db!.scene.update({
    where: { id: scene.id },
    data: {
      layoutJson: JSON.stringify({
        locks: { copy: false, assets: true, scene: false },
      }),
    },
  });
  await runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.authorize).not.toHaveBeenCalled();
  const hash = (await mediaRankingSource(scriptId)).sourceHash;
  await expect(
    startMediaRanking(scriptId, {
      ...input,
      idempotencyKey: "new-protected-key",
      expectedHash: hash,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("rejects mismatched vision IDs and expires orphaned jobs without replay", async () => {
  const { scriptId, input } = await setup();
  const job = await startMediaRanking(scriptId, input);
  m.generate.mockResolvedValueOnce([
    { ...scores[0], candidateId: "fabricated" },
  ]);
  await runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  expect((await readMediaRanking(scriptId, job.id)).job).toMatchObject({
    state: "failed",
    callsUsed: 1,
    assessments: [],
  });
  await m.db!.mediaRankingJob.update({
    where: { id: job.id },
    data: { state: "running", deadlineAt: new Date(0) },
  });
  expect((await readMediaRanking(scriptId, job.id)).job.state).toBe("failed");
  await runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  expect(m.generate).toHaveBeenCalledOnce();
});

it("atomically rejects protected or stale visual selection while preserving all copy", async () => {
  const { scriptId, scene, input } = await setup();
  const job = await startMediaRanking(scriptId, input);
  await runMediaRanking(scriptId, job.id, m.authorize, dependencies);
  const asset = await m.db!.asset.create({
    data: { type: "image", path: "fixture.jpg" },
  });
  const snapshot = {
    schemaVersion: 1 as const,
    resolvedAt: new Date().toISOString(),
    localAssetId: asset.id,
    contentHash: "a".repeat(64),
    providerSnapshot: candidate,
    selectedRendition: candidate.renderRenditions[0],
    sourceRevision: {
      capturedAt: new Date().toISOString(),
      termsUrl: "https://www.pexels.com/license/",
    },
    usageEvent: { state: "not-required" as const },
  };
  const opts = { rankingJobId: job.id, expectedSourceHash: job.sourceHash };
  const result = await applyStockMediaSelection(
    scene.id,
    snapshot,
    { type: "image", url: "/media/fixture.jpg" },
    opts,
  );
  expect(result.scene.text).toBe(scene.text);
  expect(result.scene.spokenText).toBe(scene.spokenText);
  await expect(
    applyStockMediaSelection(
      scene.id,
      snapshot,
      { type: "image", url: "/media/fixture.jpg" },
      opts,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await m.db!.scene.update({
    where: { id: scene.id },
    data: {
      layoutJson: JSON.stringify({
        locks: { copy: false, assets: true, scene: false },
      }),
    },
  });
  await expect(
    applyStockMediaSelection(scene.id, snapshot, {
      type: "image",
      url: "/media/fixture.jpg",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
