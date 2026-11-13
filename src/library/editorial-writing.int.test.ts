// @vitest-environment node
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";
import { buildPrompt } from "@/providers/ai/prompt";
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
  admitEditorialScript,
} from "./editorial-writing";
import { readEditorialRecord } from "./repositories/editorial";
import { importExternalEvidence } from "./research-import";
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
it("saves linked writing before layout, deduplicates reconnects, and guards edits/locks", async () => {
  const evidence = await importExternalEvidence(evidenceFixture());
  const input = { ...request(), evidenceId: evidence.id };
  const created = await startEditorialWriting(input);
  expect(
    await m.db!.scene.count({ where: { scriptId: created.scriptId } }),
  ).toBe(0);
  await runEditorialWriting(created.scriptId, m.authorize);
  const saved = (await readEditorialRecord(created.scriptId))!;
  expect(saved.workflow).toMatchObject({
    state: "ready",
    callsUsed: 1,
    revision: 1,
    request: { modelId: "fixture-writer" },
  });
  expect(saved.workflow.draft?.beats[0]?.references).toEqual(
    plan().scenes[0]!.evidenceRefs,
  );
  expect(await startEditorialWriting(input)).toEqual(created);
  await runEditorialWriting(created.scriptId, m.authorize);
  expect(m.generate).toHaveBeenCalledOnce();
  expect(m.generate.mock.calls[0][0]).toMatchObject({
    mode: "editorial_script",
    allowStructuredRepair: false,
    mediaPreference: "none",
  });
  await expect(
    startEditorialWriting({ ...input, brief: "Changed source" }),
  ).rejects.toMatchObject({ status: 409 });
  const locked = structuredClone(saved.workflow.draft!);
  locked.beats[0]!.locked = true;
  await controlEditorialWriting(created.scriptId, {
    action: "save",
    expectedRevision: 1,
    draft: locked,
  });
  const changed = structuredClone(locked);
  changed.beats[0]!.narration = "Different copy";
  await expect(
    controlEditorialWriting(created.scriptId, {
      action: "save",
      expectedRevision: 2,
      draft: changed,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    controlEditorialWriting(created.scriptId, {
      action: "save",
      expectedRevision: 1,
      draft: locked,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("cancels a running generation without publishing late work or replaying the writer", async () => {
  let resolve: (value: ReturnType<typeof plan>) => void = () => {};
  m.generate.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const created = await startEditorialWriting(request("editorial-cancel"));
  const running = runEditorialWriting(created.scriptId, m.authorize);
  await vi.waitFor(() => expect(m.generate).toHaveBeenCalledOnce());
  await controlEditorialWriting(created.scriptId, { action: "cancel" });
  resolve(plan());
  await running;
  expect((await readEditorialRecord(created.scriptId))!.workflow).toMatchObject(
    { state: "canceled", callsUsed: 1 },
  );
  await controlEditorialWriting(created.scriptId, { action: "resume" });
  await runEditorialWriting(created.scriptId, m.authorize);
  expect(m.generate).toHaveBeenCalledOnce();
});
it("rejects fabricated numbers and dangling source references", () => {
  const evidence = evidenceFixture();
  const broken = plan();
  broken.scenes[0]!.evidenceRefs![0]!.excerptId = "missing";
  expect(() => admitEditorialScript(broken, request(), evidence)).toThrow(
    "invalid evidence reference",
  );
  const numeric = plan();
  numeric.scenes[0]!.spokenText = "Revenue increased 999%";
  expect(() => admitEditorialScript(numeric, request(), evidence)).toThrow(
    "unsupported numbers",
  );
});
it.each([
  [
    "product",
    "The editor stores projects locally.",
    "Supplied product mechanism",
  ],
  ["explainer", "Review sources before recording narration.", "How it works"],
  [
    "news",
    "The announcement was published on 29 October 2026; rollout is unconfirmed.",
    "What is uncertain",
  ],
  [
    "data",
    "Completion rose from 42% to 68% in the supplied sample; causation is unknown.",
    "Exact comparison",
  ],
] as const)(
  "preserves %s source copy, timing and missing-evidence flags",
  (intent, copy, phase) => {
    const input = request();
    input.creativeBrief.intent = intent;
    input.brief = copy;
    const fixture = plan();
    fixture.scenes[0]!.text = copy;
    fixture.scenes[0]!.spokenText = copy;
    fixture.scenes[0]!.evidenceRefs = [];
    const admitted = admitEditorialScript(fixture, input, null);
    expect(admitted.beats[0]!.narration).toBe(copy);
    expect(admitted.estimatedSeconds).toBeGreaterThan(0);
    expect(admitted.gaps.join(" ")).toContain("no linked excerpt");
    const prompt = buildPrompt({
      mode: "editorial_script",
      brief: copy,
      creativeBrief: input.creativeBrief,
    });
    expect(prompt.system).toContain(phase);
    expect(prompt.system).toContain("before any layout");
    expect(prompt.user).toContain(copy);
    expect(
      buildPrompt({
        mode: "editorial_script",
        brief: copy,
        creativeBrief: input.creativeBrief,
      }),
    ).toEqual(prompt);
  },
);
