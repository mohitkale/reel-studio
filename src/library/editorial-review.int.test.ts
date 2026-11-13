// @vitest-environment node
import { getScript } from "./repositories/scripts";
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";

import { scenePlanSchema } from "@/providers/ai/types";
import { editorialCreationRequestSchema } from "@/production/editorial";

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
} from "./editorial-writing";
import { readEditorialRecord } from "./repositories/editorial";

import { controlEditorialStoryboard } from "./editorial-storyboard";
import {
  controlEditorialReview,
  readEditorialReview,
} from "./editorial-review";
import { editorialReviewControlSchema } from "@/production/editorial-review";

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
async function ready(key = "editorial-review", budget = 2) {
  const fixture = plan();
  fixture.scenes[0].evidenceRefs = [];
  fixture.scenes[0].spokenText =
    "A local-first editor stores projects locally. Review sources before publishing.";
  fixture.scenes.push({
    ...fixture.scenes[0],
    text: "Review sources",
    spokenText: "Review sources before publishing.",
  });
  m.generate.mockResolvedValueOnce(fixture);
  const input = request(key);
  input.budget.maxProviderCalls = budget;
  const created = await startEditorialWriting(input);
  await runEditorialWriting(created.scriptId, m.authorize);
  const cache = await controlEditorialStoryboard(created.scriptId, {
    action: "compile",
    expectedRevision: 1,
    budget: { maxProviderCalls: 0 },
  });
  await controlEditorialStoryboard(created.scriptId, {
    action: "apply",
    expectedHash: cache.sourceHash,
  });
  const scenes = await m.db!.scene.findMany({
    where: { scriptId: created.scriptId },
    orderBy: { order: "asc" },
  });
  return { ...created, scenes };
}
async function preview(
  scriptId: string,
  sceneId: string,
  kind: "make-specific" | "shorten" | "replace-visual" | "change-direction",
  extra: Record<string, unknown> = {},
) {
  const review = await readEditorialReview(scriptId);
  return editorialReviewControlSchema.parse({
    action: "preview",
    key: `revision-${Math.random()}`,
    expectedHash: review.sourceHash,
    sceneId,
    kind,
    detail: "",
    budget: { maxProviderCalls: 0 },
    ...extra,
  });
}
it("previews a bounded copy diff, applies only the chosen scene and supports guarded undo", async () => {
  const { scriptId, scenes } = await ready();
  const input = await preview(scriptId, scenes[0].id, "shorten", {
    copy: {
      screenCopy: "Work locally",
      narration: "A local-first editor stores projects locally.",
    },
  });
  const proposal = await controlEditorialReview(scriptId, input, m.authorize);
  expect(
    (await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[0].id } }))
      .spokenText,
  ).toBe(scenes[0].spokenText);
  expect(proposal.after.layoutJson).toBe(proposal.before.layoutJson);
  const applied = await controlEditorialReview(scriptId, {
    action: "apply",
    proposalId: proposal.id,
    expectedHash: proposal.sourceHash,
  });
  expect(
    await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[1].id } }),
  ).toEqual(scenes[1]);
  await controlEditorialReview(scriptId, {
    action: "undo",
    proposalId: proposal.id,
    expectedHash: applied.appliedHash!,
  });
  expect(
    (await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[0].id } }))
      .spokenText,
  ).toBe(scenes[0].spokenText);
  expect(m.generate).toHaveBeenCalledOnce();
});
it("keeps copy and paid writing for visual/direction edits, rejects locks and stale proposals", async () => {
  const { scriptId, scenes } = await ready();
  const direction = await controlEditorialReview(
    scriptId,
    await preview(scriptId, scenes[0].id, "change-direction"),
  );
  expect(direction.after.text).toBe(direction.before.text);
  expect(direction.after.spokenText).toBe(direction.before.spokenText);
  expect(direction.after.assetRefs).toBe(direction.before.assetRefs);
  expect(direction.after.layoutJson).not.toBe(direction.before.layoutJson);
  await m.db!.scene.update({
    where: { id: scenes[1].id },
    data: { text: "Changed elsewhere" },
  });
  await expect(
    controlEditorialReview(scriptId, {
      action: "apply",
      proposalId: direction.id,
      expectedHash: direction.sourceHash,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await m.db!.scene.update({
    where: { id: scenes[0].id },
    data: {
      layoutJson: JSON.stringify({
        locks: { copy: true, assets: false, scene: false },
      }),
    },
  });
  await expect(
    controlEditorialReview(
      scriptId,
      await preview(scriptId, scenes[0].id, "make-specific", {
        detail: "Concrete local workflow",
        copy: { screenCopy: "Local", narration: "Concrete local workflow" },
      }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  const asset = await m.db!.asset.create({
    data: {
      type: "image",
      path: "fixtures/editorial.png",
      name: "Real supplied screenshot",
    },
  });
  const visual = await controlEditorialReview(
    scriptId,
    await preview(scriptId, scenes[0].id, "replace-visual", {
      assetId: asset.id,
    }),
  );
  expect(visual.after.text).toBe(visual.before.text);
  expect(visual.after.assetRefs).toBe(JSON.stringify([asset.id]));
  const applied = await controlEditorialReview(scriptId, {
    action: "apply",
    proposalId: visual.id,
    expectedHash: visual.sourceHash,
  });
  const selected = (await getScript(scriptId))!.scenes.find(
    (scene) => scene.id === scenes[0].id,
  )!;
  expect(selected.background?.type).toBe("image");
  expect(selected.locks?.copy).toBe(true);
  await m.db!.scene.update({
    where: { id: scenes[1].id },
    data: { text: "A later edit" },
  });
  await expect(
    controlEditorialReview(scriptId, {
      action: "undo",
      proposalId: visual.id,
      expectedHash: applied.appliedHash!,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.generate).toHaveBeenCalledOnce();
});
it("reserves one explicit rewrite call, caches reconnects and enforces the cumulative budget", async () => {
  const { scriptId, scenes } = await ready();
  const fixture = plan();
  fixture.scenes[0].spokenText = "Projects stay local.";
  fixture.scenes[0].text = "Local projects";
  m.generate.mockResolvedValueOnce(fixture);
  const input = await preview(scriptId, scenes[0].id, "make-specific", {
    detail: "Projects stay local.",
    budget: { maxProviderCalls: 1 },
  });
  const proposal = await controlEditorialReview(scriptId, input, m.authorize);
  expect(proposal.state).toBe("ready");
  expect(await controlEditorialReview(scriptId, input, m.authorize)).toEqual(
    proposal,
  );
  expect(m.generate).toHaveBeenCalledTimes(2);
  expect(m.generate.mock.calls[1][0]).toMatchObject({
    mode: "rewrite",
    sceneCount: 1,
    mediaPreference: "none",
    allowStructuredRepair: false,
    modelId: "fixture-writer",
  });
  expect((await readEditorialRecord(scriptId))!.workflow).toMatchObject({
    callsUsed: 1,
    revisionCallsUsed: 1,
  });
  await expect(
    controlEditorialReview(
      scriptId,
      await preview(scriptId, scenes[1].id, "shorten", {
        budget: { maxProviderCalls: 1 },
      }),
      m.authorize,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.generate).toHaveBeenCalledTimes(2);
});
it("cancels paid work without late publication, automatic replay or raw provider errors", async () => {
  const { scriptId, scenes } = await ready();
  let finish: (value: ReturnType<typeof plan>) => void = () => {};
  m.generate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const input = await preview(scriptId, scenes[0].id, "make-specific", {
    detail: "Projects stay local.",
    budget: { maxProviderCalls: 1 },
  });
  const running = controlEditorialReview(scriptId, input, m.authorize);
  await vi.waitFor(() => expect(m.generate).toHaveBeenCalledTimes(2));
  const active = (await readEditorialReview(scriptId)).proposal!;
  await m.db!.scene.update({
    where: { id: scenes[1].id },
    data: { text: "Changed while writer runs" },
  });
  await controlEditorialReview(scriptId, {
    action: "cancel",
    proposalId: active.id,
    expectedHash: active.sourceHash,
  });
  finish(plan());
  await running;
  expect((await readEditorialReview(scriptId)).proposal?.state).toBe(
    "canceled",
  );
  expect(
    (await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[0].id } }))
      .spokenText,
  ).toBe(scenes[0].spokenText);
  await controlEditorialReview(scriptId, input, m.authorize);
  expect(m.generate).toHaveBeenCalledTimes(2);
});
it("reports unsupported copy, repeated beats, filler and a missing payoff", async () => {
  const { scriptId, scenes } = await ready();
  for (const scene of scenes)
    await m.db!.scene.update({
      where: { id: scene.id },
      data: {
        text: "A revolutionary game-changer",
        spokenText: "A revolutionary game-changer grew 999%.",
      },
    });
  const kinds = (await readEditorialReview(scriptId)).findings.map(
    (f) => f.kind,
  );
  expect(kinds).toEqual(
    expect.arrayContaining([
      "unsupported-claim",
      "repetition",
      "filler",
      "missing-payoff",
    ]),
  );
  await expect(
    controlEditorialReview(
      scriptId,
      await preview(scriptId, scenes[0].id, "make-specific", {
        detail: "A supported detail",
        copy: { screenCopy: "Growth 12345%", narration: "Growth 12345%" },
      }),
    ),
  ).rejects.toMatchObject({ status: 422 });
});
it("expires orphaned revisions without replaying reserved calls and respects writing-beat locks", async () => {
  const { scriptId, scenes } = await ready();
  const record = (await readEditorialRecord(scriptId))!;
  record.workflow.draft!.beats[0].locked = true;
  await m.db!.script.update({
    where: { id: scriptId },
    data: {
      brandOverrides: JSON.stringify({
        ...JSON.parse(
          (await m.db!.script.findUniqueOrThrow({ where: { id: scriptId } }))
            .brandOverrides!,
        ),
        editorialWorkflow: record.workflow,
      }),
    },
  });
  await expect(
    controlEditorialReview(
      scriptId,
      await preview(scriptId, scenes[0].id, "shorten", {
        copy: { screenCopy: "Local", narration: "Local creation." },
      }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  const proposal = await controlEditorialReview(
    scriptId,
    await preview(scriptId, scenes[1].id, "change-direction"),
  );
  const row = await m.db!.script.findUniqueOrThrow({ where: { id: scriptId } }),
    overrides = JSON.parse(row.brandOverrides!);
  overrides.editorialProposal = {
    ...proposal,
    state: "running",
    deadlineAt: "2020-01-01T00:00:00.000Z",
    providerCalls: 1,
  };
  await m.db!.script.update({
    where: { id: scriptId },
    data: { brandOverrides: JSON.stringify(overrides) },
  });
  expect((await readEditorialReview(scriptId)).proposal?.state).toBe("failed");
  expect(m.generate).toHaveBeenCalledOnce();
});
it("checks cancellation again after quota authorization before dispatching a provider", async () => {
  const { scriptId, scenes } = await ready();
  let release: () => void = () => {};
  m.authorize.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const input = await preview(scriptId, scenes[0].id, "make-specific", {
    detail: "Keep projects locally",
    budget: { maxProviderCalls: 1 },
  });
  const running = controlEditorialReview(scriptId, input, m.authorize);
  await vi.waitFor(() => expect(m.authorize).toHaveBeenCalledTimes(2));
  const active = (await readEditorialReview(scriptId)).proposal!;
  await controlEditorialReview(scriptId, {
    action: "cancel",
    proposalId: active.id,
    expectedHash: active.sourceHash,
  });
  release();
  await running;
  expect(m.generate).toHaveBeenCalledOnce();
  expect((await readEditorialReview(scriptId)).proposal?.state).toBe(
    "canceled",
  );
});
