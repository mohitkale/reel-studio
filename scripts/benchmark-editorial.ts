/** Explicit active-app benchmark. Fixtures by default; --paid requires a model and call cap. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { prisma } from "../src/library/db";
import { getMcpToken } from "../src/server/secrets";
import { importExternalEvidence } from "../src/library/research-import";
import {
  startEditorialWriting,
  runEditorialWriting,
} from "../src/library/editorial-writing";
import { readEditorialRecord } from "../src/library/repositories/editorial";
import { controlEditorialStoryboard } from "../src/library/editorial-storyboard";
import { readEditorialReview } from "../src/library/editorial-review";
import { getScript } from "../src/library/repositories/scripts";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getAIProvider } from "../src/providers/ai/registry";
import {
  AI_PROVIDER_IDS,
  type AIProvider,
  scenePlanSchema,
} from "../src/providers/ai/types";
import { boundedGeneration } from "../src/library/bounded-generation";
import { submitProduction } from "../src/library/production-service";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";
import {
  BENCHMARK_VERSION,
  BENCHMARK_BRIEFS,
  BENCHMARK_MODES,
  benchmarkEvidence,
  benchmarkPlan,
  benchmarkMetrics,
  benchmarkReviewSchema,
} from "../src/production/editorial-benchmark";

const run = promisify(execFile);
const options = parseArgs({
  options: {
    "save-examples": { type: "boolean", default: false },
    render: { type: "boolean", default: false },
    paid: { type: "boolean", default: false },
    provider: { type: "string" },
    model: { type: "string" },
    "max-writer-calls": { type: "string" },
    "review-file": { type: "string" },
    manifest: { type: "string" },
  },
}).values;
const outputSchema = z.object({
  scriptId: z.string(),
  output: z.object({ checksum: z.string(), path: z.string().min(1).max(4096) }),
});
async function validateReview() {
  assert.ok(options.manifest, "Supply --manifest from the same run");
  const review = benchmarkReviewSchema.parse(
    JSON.parse(await readFile(options["review-file"]!, "utf8")),
  );
  const manifest = z
    .object({ runId: z.string(), rows: z.array(outputSchema) })
    .parse(JSON.parse(await readFile(options.manifest, "utf8")));
  assert.equal(review.runId, manifest.runId, "Review belongs to another run");
  assert.equal(review.reviews.length, 15, "Review all fifteen exports");
  assert.equal(manifest.rows.length, 15);
  for (const item of review.reviews) {
    assert.equal(
      item.status,
      "accepted",
      `Unaccepted export: ${item.scriptId}`,
    );
    assert.equal(
      item.outputChecksum,
      manifest.rows.find((r) => r.scriptId === item.scriptId)?.output.checksum,
      "Review checksum mismatch",
    );
    const output = manifest.rows.find(
      (r) => r.scriptId === item.scriptId,
    )!.output;
    assert.equal(
      path.extname(output.path).toLowerCase(),
      ".mp4",
      "Review a video export",
    );
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(output.path)) hash.update(bytes);
    assert.equal(
      `sha256:${hash.digest("hex")}`,
      item.outputChecksum,
      "Export bytes changed since review",
    );
  }
  console.log(
    "All fifteen export reviews accepted and bound to this run's checksums.",
  );
}
async function main() {
  if (options["review-file"]) return validateReview();
  assert.ok(
    options["save-examples"],
    "Use --save-examples to intentionally create fifteen active-app projects; add --render for verified exports.",
  );
  assert.ok(!options.render || options["save-examples"]);
  const providerId = z
    .enum(AI_PROVIDER_IDS)
    .parse(options.provider ?? "ollama");
  if (options.paid) {
    assert.ok(
      options.provider && options.model,
      "Paid runs require explicit --provider and --model",
    );
    assert.equal(
      Number(options["max-writer-calls"]),
      15,
      "Explicitly grant --max-writer-calls=15 (one per example; research/vision/voice stay zero)",
    );
    assert.ok(
      getAIProvider(providerId).isConfigured(),
      "Selected writer is not configured",
    );
  } else {
    assert.ok(
      !options.provider && !options.model && !options["max-writer-calls"],
      "Provider options require --paid; fixture runs never contact a writer",
    );
  }
  const baseUrl = process.env.BENCHMARK_URL ?? "http://127.0.0.1:3020";
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname),
    "Benchmark only targets the active local app",
  );
  const token = getMcpToken();
  assert.ok(
    token,
    "An existing MCP token is required for the real MCP → HTTP acceptance path",
  );
  process.env.REEL_STUDIO_URL = baseUrl;
  process.env.REEL_STUDIO_MCP_TOKEN = token;
  const { registerEditorialTools } = await import("../mcp/src/editorial-tools");
  const server = new McpServer({
    name: "editorial-benchmark",
    version: "1.0.0",
  });
  registerEditorialTools(server);
  const client = new Client({
    name: "editorial-benchmark-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await client.callTool({ name, arguments: args });
    assert.ok(
      !response.isError,
      `MCP ${name} failed (inspect the local app; no automatic retry)`,
    );
    const content = z
      .array(z.object({ type: z.literal("text"), text: z.string() }))
      .parse(response.content);
    return JSON.parse(content[0].text) as unknown;
  };
  const runId = randomUUID(),
    directory = `.artifacts/visual-quality-m5/benchmark-${runId}`;
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const manifest = {
    version: BENCHMARK_VERSION,
    runId,
    createdAt: new Date().toISOString(),
    execution: options.paid ? "opt-in-live-writer" : "offline-writer-fixtures",
    sourcePolicy:
      "Frozen supplied snapshots, external/unverified; no fresh search",
    brandPolicy:
      "Explicit null brand kit in all modes; identical resolved default brand tokens required",
    mcpPath:
      "Shared-library writing seed; real SDK tool transport → authenticated HTTP for status, compile, apply and review",
    paidWriterCallsReserved: 0,
    fixtureWriterInvocations: 0,
    researchCalls: 0,
    visionCalls: 0,
    voiceCalls: 0,
    currencyCost: options.paid ? null : 0,
    status: "running",
    rows: [] as Array<Record<string, unknown>>,
    humanExportReview: "pending",
  };
  const persist = () =>
    writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2));
  await persist();
  const reviews: z.infer<typeof benchmarkReviewSchema>["reviews"] = [];
  try {
    assert.equal(
      await prisma.productionJob.count({
        where: { state: { in: ["queued", "running"] } },
      }),
      0,
      "Finish active jobs first",
    );
    for (const brief of BENCHMARK_BRIEFS) {
      const evidence = await importExternalEvidence(benchmarkEvidence(brief));
      for (const mode of BENCHMARK_MODES) {
        const began = performance.now(),
          linked = mode !== "baseline";
        const fixture = benchmarkPlan(brief, linked);
        const fixtureProvider: AIProvider = {
          id: "ollama",
          label: "Offline benchmark fixture",
          isConfigured: () => true,
          listModels: async () => [],
          generatePlan: async () => fixture,
          generatePodcastPlan: async () => {
            throw new Error("Unused");
          },
          generatePodcastClipSuggestions: async () => [],
        };
        const provider = options.paid
          ? getAIProvider(providerId)
          : fixtureProvider;
        const row: Record<string, unknown> = {
          brief: brief.id,
          mode,
          state: "writing",
          manualRepairOperations: 0,
          sourceTitle: brief.sourceTitle,
        };
        manifest.rows.push(row);
        // Save reservation before dispatch; a stopped run is never resumed/replayed.
        if (options.paid) manifest.paidWriterCallsReserved += 1;
        else manifest.fixtureWriterInvocations += 1;
        await persist();
        let created: { projectId: string; scriptId: string };
        if (!linked) {
          const plan = options.paid
            ? scenePlanSchema.parse(
                await boundedGeneration(
                  provider.generatePlan({
                    mode: "idea",
                    brief: `${brief.brief}\nSupplied facts:\n${brief.facts}`,
                    sceneCount: 2,
                    modelId: options.model,
                    mediaPreference: "none",
                    scriptStyle: "detailed",
                    videoEngine: "hyperframes",
                    allowStructuredRepair: false,
                    signal: AbortSignal.timeout(45000),
                  }),
                  AbortSignal.timeout(45000),
                ),
              )
            : await fixtureProvider.generatePlan({
                mode: "idea",
                brief: brief.brief,
              });
          const preset =
            brief.intent === "product"
              ? "product-launch"
              : brief.intent === "data"
                ? "data-story"
                : brief.intent === "brand"
                  ? "cinematic-brand"
                  : "editorial-explainer";
          created = await createProjectFromPlan(
            plan,
            "portrait",
            [],
            "hyperframes",
            { styleId: "clean-story", energy: "calm" },
            {
              preset: { id: preset, version: "1.0.0" },
              brandKitId: null,
              mediaPreferences: plan.scenes.map(() => "none"),
            },
          );
        } else {
          created = await startEditorialWriting({
            idempotencyKey: `benchmark:${runId}:${brief.id}:${mode}`,
            brief: `${brief.brief}\nSupplied facts:\n${brief.facts}`,
            creativeBrief: {
              intent: brief.intent,
              audience: "Creators reviewing a sourced film",
              goal: brief.brief,
              language: "English",
              targetSeconds: 15,
              tone: "Specific and measured",
              takeaway: brief.scenes.at(-1)!.text,
            },
            providerId: options.paid ? providerId : "ollama",
            modelId: options.paid ? options.model : "offline-benchmark-fixture",
            evidenceId: evidence.id,
            orientation: "portrait",
            budget: { maxProviderCalls: 1, deadlineMs: 45000 },
          });
          Object.assign(row, created);
          await persist();
          await runEditorialWriting(created.scriptId, async () => {}, {
            getProvider: () => provider,
          });
          const record = await readEditorialRecord(created.scriptId);
          assert.equal(
            record?.workflow.state,
            "ready",
            "Writing did not complete; no paid retry",
          );
          if (mode === "researched-mcp") {
            await call("get_editorial_script", { scriptId: created.scriptId });
            const preview = z
              .object({ storyboard: z.object({ sourceHash: z.string() }) })
              .parse(
                await call("control_editorial_storyboard", {
                  scriptId: created.scriptId,
                  control: {
                    action: "compile",
                    expectedRevision: 1,
                    budget: { maxProviderCalls: 0 },
                  },
                }),
              );
            await call("control_editorial_storyboard", {
              scriptId: created.scriptId,
              control: {
                action: "apply",
                expectedHash: preview.storyboard.sourceHash,
              },
            });
          } else {
            const preview = await controlEditorialStoryboard(created.scriptId, {
              action: "compile",
              expectedRevision: 1,
              budget: { maxProviderCalls: 0 },
            });
            await controlEditorialStoryboard(created.scriptId, {
              action: "apply",
              expectedHash: preview.sourceHash,
            });
          }
        }
        Object.assign(row, created);
        await prisma.project.update({
          where: { id: created.projectId },
          data: {
            name: `M5 Benchmark · ${brief.id} · ${mode} · ${options.paid ? "live" : "fixture"} · ${runId.slice(0, 8)}`,
          },
        });
        const script = (await getScript(created.scriptId))!;
        const brandChecksum = createHash("sha256")
          .update(JSON.stringify(script.brandTokens))
          .digest("hex");
        const copyChecksum = createHash("sha256")
          .update(
            JSON.stringify(
              script.scenes.map((s) => ({
                text: s.text,
                narration: s.spokenText ?? s.text,
              })),
            ),
          )
          .digest("hex");
        if (!options.paid && mode !== "baseline") {
          const baseline = manifest.rows.find(
            (r) => r.brief === brief.id && r.mode === "baseline",
          );
          assert.equal(
            copyChecksum,
            baseline?.copyChecksum,
            "Offline comparison must preserve identical source copy",
          );
          assert.equal(
            brandChecksum,
            baseline?.brandChecksum,
            "Offline comparison must use identical resolved brand tokens",
          );
        }
        const review =
          mode === "researched-mcp"
            ? z
                .object({ findings: z.array(z.object({ kind: z.string() })) })
                .parse(
                  await call("get_editorial_review", { scriptId: script.id }),
                )
            : await readEditorialReview(script.id);
        Object.assign(row, {
          state: "saved",
          copyChecksum,
          brandChecksum,
          brandTokens: script.brandTokens,
          metrics: benchmarkMetrics(brief, script),
          findings: review.findings.map((f) => f.kind),
          creationMs: Math.round(performance.now() - began),
          actualWriterCalls: options.paid ? 1 : 0,
          fixtureWriterInvocations: options.paid ? 0 : 1,
        });
        await persist();
        if (options.render) {
          const renderBegan = performance.now();
          const job = await submitProduction({
            request: {
              kind: "video",
              scriptId: script.id,
              orientation: "portrait",
              quality: "draft",
              idempotencyKey: `benchmark-export:${runId}:${script.id}`,
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
            serverBaseUrl: baseUrl,
          });
          assert.ok(job);
          row.jobId = job.id;
          await persist();
          assert.equal(
            await prisma.productionJob.count({
              where: {
                id: { not: job.id },
                state: { in: ["queued", "running"] },
              },
            }),
            0,
            "Another active job appeared; do not execute unrelated work",
          );
          await runProductionWorkerOnce({
            workerId: `benchmark:${runId}`,
            execute: executeProductionJob,
          });
          const saved = await prisma.productionJob.findUniqueOrThrow({
            where: { id: job.id },
            include: { outputs: true },
          });
          assert.equal(
            saved.state,
            "succeeded",
            saved.error ?? "Export failed",
          );
          const output = saved.outputs.find((o) => o.kind === "video")!;
          assert.ok(output);
          const { stdout } = await run(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_entries",
              "format=duration:stream=width,height,r_frame_rate,nb_frames",
              "-of",
              "json",
              output.path,
            ],
            { timeout: 10000, maxBuffer: 1024 * 1024 },
          );
          const media = z
            .object({
              streams: z.array(
                z.object({
                  width: z.number(),
                  height: z.number(),
                  r_frame_rate: z.string(),
                  nb_frames: z.string(),
                }),
              ),
              format: z.object({ duration: z.coerce.number().positive() }),
            })
            .parse(JSON.parse(stdout));
          assert.ok(
            media.streams.some(
              (s) =>
                s.width === 1080 &&
                s.height === 1920 &&
                s.r_frame_rate === "30/1",
            ),
          );
          for (const [index, fraction] of [0.25, 0.75].entries())
            await run(
              "ffmpeg",
              [
                "-v",
                "error",
                "-ss",
                String(media.format.duration * fraction),
                "-i",
                output.path,
                "-frames:v",
                "1",
                "-vf",
                "scale=270:480",
                "-y",
                `${directory}/${brief.id}-${mode}-${index}.png`,
              ],
              { timeout: 10000 },
            );
          Object.assign(row, {
            state: "exported",
            output: {
              path: path.relative(process.cwd(), output.path),
              checksum: output.checksum,
            },
            media,
            renderMs: Math.round(performance.now() - renderBegan),
            agentFrameReview: "pending",
          });
          reviews.push({
            scriptId: script.id,
            outputChecksum: output.checksum!,
            status: "pending",
            reviewer: null,
            factualSupport: null,
            specificity: null,
            narrative: null,
            visualRelevance: null,
            pacing: null,
            manualEdits: null,
            notes:
              "Watch the full export and check actual sources, supplied proof, text, timing and continuity. Fixture linkage is not semantic fact verification.",
          });
          await persist();
        }
        console.log(
          `${brief.id} ${mode}: ${row.state} (${manifest.rows.length}/15)`,
        );
      }
    }
    manifest.status = "complete";
    await persist();
    await writeFile(
      `${directory}/human-review.json`,
      JSON.stringify(
        benchmarkReviewSchema.parse({ version: 1, runId, reviews }),
        null,
        2,
      ),
    );
    console.log(`Benchmark evidence: ${directory}/manifest.json`);
  } catch (error) {
    manifest.status = "failed";
    await persist();
    for (const row of manifest.rows)
      if (typeof row.projectId === "string")
        await prisma.project
          .update({
            where: { id: row.projectId },
            data: {
              name: `M5 Benchmark · Incomplete run ${runId.slice(0, 8)} · ${row.brief} · ${row.mode}`,
            },
          })
          .catch(() => undefined);
    throw error;
  } finally {
    await client.close();
    await server.close();
  }
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Benchmark failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
