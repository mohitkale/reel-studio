/** Opt-in offline acceptance. Saves one named example and verified export in the active app. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/library/db";
import { evidenceFixture } from "../src/research/fixtures";
import { importExternalEvidence } from "../src/library/research-import";
import { scenePlanSchema } from "../src/providers/ai/types";
import { applyPresetToAIPlan } from "../src/production/ai-preset-plan";
import { creationEvidenceSources } from "../src/research/creation-grounding";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import { submitProduction } from "../src/library/production-service";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";

async function main() {
  assert.equal(
    await prisma.productionJob.count({
      where: { state: { in: ["queued", "running"] } },
    }),
    0,
    "Finish active jobs before running this acceptance fixture",
  );
  const pack = evidenceFixture();
  pack.query = "Compare the supplied draft and review figures in a chart";
  pack.sources[0]!.title = "Synthetic review fixture";
  pack.sources[0]!.excerpts[0]!.text =
    "Synthetic figures, not customer outcomes.\nDraft: 42%\nReview: 68%";
  pack.claims = [];
  const evidence = await importExternalEvidence(pack);
  const directed = applyPresetToAIPlan(
    scenePlanSchema.parse({
      projectName: "Research M3 · Evidence and saved remix",
      scriptName: "Synthetic source review",
      scenes: [
        {
          templateId: "hf-statement",
          text: "Start with supplied evidence.",
          emphasis: [],
        },
        {
          templateId: "hf-data-chart",
          text: "Compare the synthetic figures.",
          emphasis: [],
          chart: {
            labels: ["Draft", "Review"],
            series: [{ label: "Supplied values", values: [42, 68], unit: "%" }],
          },
        },
        {
          templateId: "hf-statement",
          text: "Review sources before publishing.",
          emphasis: [],
        },
      ],
    }),
    "data-story",
    "hyperframes",
    { source: pack.query, evidenceSources: creationEvidenceSources(evidence) },
  );
  assert.deepEqual(directed.plan.scenes[1]!.chart?.series[0]!.values, [42, 68]);
  const quickProduce = {
    enabled: true as const,
    planner: "lm-studio" as const,
    plannerModelId: "offline-fixture",
    mediaPreference: "none" as const,
    voice: {
      enabled: false,
      providerId: "kokoro-server" as const,
      voiceId: "af_heart",
    },
  };
  const created = await createProjectFromPlan(
    directed.plan,
    "portrait",
    [],
    "hyperframes",
    undefined,
    {
      preset: { id: "data-story", version: "1.0.0" },
      roles: directed.roles,
      savedOverrides: {
        researchEvidence: evidence,
        creationSettings: {
          brief: pack.query,
          mode: "idea",
          writer: { providerId: "lm-studio", modelId: "offline-fixture" },
          orientation: "portrait",
          brandKitId: null,
          mediaPreference: "none",
          productionPresetId: "data-story",
          quickProduce,
        },
      },
    },
  );
  const snapshot = await captureVideoSnapshot(created.scriptId);
  assert.equal(snapshot.script.researchEvidence?.id, evidence.id);
  const job = await submitProduction({
    request: {
      kind: "video",
      scriptId: created.scriptId,
      orientation: "portrait",
      quality: "draft",
      idempotencyKey: `research-acceptance:${randomUUID()}`,
      runMode: "automatic",
      priority: 100,
      quickProduce,
    },
    auth: { origin: "web", token: null },
    serverBaseUrl:
      process.env.RESEARCH_ACCEPTANCE_URL ?? "http://127.0.0.1:3020",
  });
  const state = await runProductionWorkerOnce({
    workerId: `research-acceptance:${randomUUID()}`,
    execute: executeProductionJob,
  });
  assert.ok(job, "Production submission did not return a job");
  const saved = await prisma.productionJob.findUniqueOrThrow({
    where: { id: job.id },
    include: { outputs: true, productionRevision: true },
  });
  assert.equal(state, "succeeded", saved.error ?? "Export failed");
  assert.equal(saved.state, "succeeded");
  assert.ok(saved.outputs.length);
  assert.equal(
    JSON.parse(saved.productionRevision!.snapshotJson).script.researchEvidence
      .id,
    evidence.id,
  );
  await mkdir(".artifacts/research-m3", { recursive: true });
  const report = {
    ...created,
    jobId: job.id,
    evidenceId: evidence.id,
    outputs: saved.outputs.map(({ path, checksum }) => ({ path, checksum })),
  };
  await writeFile(
    ".artifacts/research-m3/acceptance.json",
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
