/** Opt-in offline acceptance: saves a named example and real export in the active app. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/library/db";
import { evidenceFixture } from "../src/research/fixtures";
import { importExternalEvidence } from "../src/library/research-import";
import { scenePlanSchema, type AIProvider } from "../src/providers/ai/types";
import {
  startEditorialWriting,
  runEditorialWriting,
} from "../src/library/editorial-writing";
import { controlEditorialStoryboard } from "../src/library/editorial-storyboard";
import {
  readEditorialReview,
  controlEditorialReview,
} from "../src/library/editorial-review";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";
import { submitProduction } from "../src/library/production-service";
async function main() {
  assert.equal(
    await prisma.productionJob.count({
      where: { state: { in: ["queued", "running"] } },
    }),
    0,
    "Finish active jobs first",
  );
  const pack = evidenceFixture();
  pack.query = "Compare synthetic draft and review figures in a chart";
  pack.sources[0].title = "Synthetic editorial fixture";
  pack.sources[0].excerpts[0].text =
    "Synthetic figures, not customer outcomes.\nDraft: 42%\nReview: 68%";
  pack.claims = [];
  const evidence = await importExternalEvidence(pack);
  const plan = scenePlanSchema.parse({
    projectName: "Review the evidence before choosing layouts",
    scriptName: "Synthetic editorial review",
    scenes: [
      {
        templateId: "hf-statement",
        text: "Write before designing.",
        spokenText:
          "Start with supplied evidence. Link every claim before choosing a visual.",
        emphasis: [],
        evidenceRefs: [],
      },
      {
        templateId: "hf-statement",
        text: "Draft: 42%\nReview: 68%",
        spokenText:
          "These synthetic review figures are 42% and 68%. They are not customer outcomes.",
        emphasis: [],
        evidenceRefs: [{ sourceId: "source-1", excerptId: "excerpt-1" }],
      },
      {
        templateId: "hf-statement",
        text: "Review sources before publishing.",
        spokenText:
          "Review sources before publishing. Keep uncertainty visible.",
        emphasis: [],
        evidenceRefs: [],
      },
    ],
  });
  const provider: AIProvider = {
    id: "ollama",
    label: "Offline fixture",
    isConfigured: () => true,
    listModels: async () => [],
    generatePlan: async () => plan,
    generatePodcastPlan: async () => {
      throw new Error("unused");
    },
    generatePodcastClipSuggestions: async () => [],
  };
  const created = await startEditorialWriting({
    idempotencyKey: `editorial-acceptance:${randomUUID()}`,
    brief: pack.sources[0].excerpts[0].text,
    creativeBrief: {
      intent: "data",
      audience: "Creators reviewing a sourced draft",
      goal: "Show how source-linked writing becomes a storyboard",
      language: "English",
      tone: "Clear and measured",
      targetSeconds: 30,
      takeaway: "Review sources before publishing",
    },
    providerId: "ollama",
    modelId: "offline-fixture",
    evidenceId: evidence.id,
    orientation: "portrait",
    budget: { maxProviderCalls: 2, deadlineMs: 30000 },
  });
  await prisma.project.update({
    where: { id: created.projectId },
    data: { name: "Editorial M4 · Script, storyboard and scoped revision" },
  });
  await runEditorialWriting(created.scriptId, async () => {}, {
    getProvider: () => provider,
  });
  const cache = await controlEditorialStoryboard(created.scriptId, {
    action: "compile",
    expectedRevision: 1,
    budget: { maxProviderCalls: 0 },
  });
  assert.deepEqual(cache.plan.scenes[1].chart?.series[0].values, [42, 68]);
  await controlEditorialStoryboard(created.scriptId, {
    action: "apply",
    expectedHash: cache.sourceHash,
  });
  const review = await readEditorialReview(created.scriptId);
  const proposal = await controlEditorialReview(created.scriptId, {
    action: "preview",
    key: `revision:${randomUUID()}`,
    expectedHash: review.sourceHash,
    sceneId: cache.shots[0].sceneId,
    kind: "shorten",
    detail: "",
    copy: {
      screenCopy: "Write before designing.",
      narration: "Link every claim before choosing a visual.",
    },
    budget: { maxProviderCalls: 0 },
  });
  const applied = await controlEditorialReview(created.scriptId, {
    action: "apply",
    proposalId: proposal.id,
    expectedHash: proposal.sourceHash,
  });
  assert.equal(
    applied.after.spokenText,
    "Link every claim before choosing a visual.",
  );
  const snapshot = await captureVideoSnapshot(created.scriptId);
  assert.equal(snapshot.script.editorialWorkflow?.callsUsed, 1);
  assert.equal(snapshot.script.editorialWorkflow?.revisionCallsUsed, 0);
  const job = await submitProduction({
    request: {
      kind: "video",
      scriptId: created.scriptId,
      orientation: "portrait",
      quality: "draft",
      idempotencyKey: `editorial-export:${randomUUID()}`,
      runMode: "automatic",
      priority: 100,
      quickProduce: {
        enabled: true,
        planner: "deterministic",
        mediaPreference: "none",
        voice: {
          enabled: false,
          providerId: "kokoro-server",
          voiceId: "af_heart",
        },
      },
    },
    auth: { origin: "web", token: null },
    serverBaseUrl:
      process.env.EDITORIAL_ACCEPTANCE_URL ?? "http://127.0.0.1:3020",
  });
  assert.ok(job);
  await runProductionWorkerOnce({
    workerId: `editorial-acceptance:${randomUUID()}`,
    execute: executeProductionJob,
  });
  let saved = await prisma.productionJob.findUniqueOrThrow({
    where: { id: job.id },
    include: { outputs: true, productionRevision: true },
  });
  const deadline = Date.now() + 180000;
  while (["queued", "running"].includes(saved.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    saved = await prisma.productionJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { outputs: true, productionRevision: true },
    });
  }
  assert.equal(
    saved.state,
    "succeeded",
    saved.error ?? "Export did not finish",
  );
  assert.ok(saved.outputs.length);
  const frozen = JSON.parse(saved.productionRevision!.snapshotJson);
  assert.equal(
    frozen.script.editorialWorkflow.draft.beats[1].references[0].excerptId,
    "excerpt-1",
  );
  const report = {
    ...created,
    jobId: job.id,
    evidenceId: evidence.id,
    outputs: saved.outputs.map(({ path, checksum }) => ({ path, checksum })),
  };
  await mkdir(".artifacts/editorial-m4", { recursive: true });
  await writeFile(
    ".artifacts/editorial-m4/acceptance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
