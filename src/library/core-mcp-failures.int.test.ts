import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { type AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  PRODUCTION_STEP_KEYS,
  type ProductionStepKey,
} from "@/production/jobs";
import { readOrCreateLocalSecret } from "@/server/local-engine";
import { connectEngine } from "../../mcp/src/client";
import { registerCoreTools } from "../../mcp/src/core-tools";

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  // This test drives the worker after submitting each job.
  after: vi.fn(),
}));

const client = new Client({ name: "reel-studio-mcp-check", version: "1" });
const mcp = new McpServer({ name: "reel-studio", version: "1" });
const home = mkdtempSync(path.join(tmpdir(), "reel-mcp-failures-"));
const realRender = process.env.REEL_MCP_TEST_RENDER === "1";
const evidence = process.env.REEL_MCP_TEST_EVIDENCE;
const rendered = new Set<string>();
let http: Server;
let prisma: typeof import("@/library/db").prisma;
let runWorker: typeof import("@/library/production-worker").runProductionWorkerOnce;
let execute: typeof import("@/library/video-production-orchestrator").executeVideoProductionJob;
let onSubmit: (() => void) | undefined;

beforeAll(async () => {
  const filename = path.join(home, "test.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => name !== "migration_lock.toml")
    .sort()) {
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  db.close();
  vi.stubEnv("DATABASE_URL", `file:${filename}`);
  vi.stubEnv("REEL_STUDIO_HOME", home);
  vi.stubEnv("REEL_STRICT_AUTH", "1");
  ({ prisma } = await import("@/library/db"));
  ({ runProductionWorkerOnce: runWorker } =
    await import("@/library/production-worker"));
  ({ executeVideoProductionJob: execute } =
    await import("@/library/video-production-orchestrator"));
  const { POST: submit } = await import("@/app/api/storyboards/route");
  const { GET: status } = await import("@/app/api/production-jobs/[id]/route");
  const { GET: artifact } =
    await import("@/app/api/production-jobs/[id]/artifacts/[outputId]/route");
  const { POST: exportFolder } =
    await import("@/app/api/production-jobs/[id]/export-folder/route");
  const { GET: media } = await import("@/app/media/[...path]/route");

  async function route(req: NextRequest): Promise<Response> {
    const segments = req.nextUrl.pathname.slice(1).split("/");
    if (segments[0] === "media")
      return media(req, {
        params: Promise.resolve({ path: segments.slice(1) }),
      });
    if (segments[1] === "storyboards") {
      const result = await submit(req);
      if (result.status === 202) onSubmit?.();
      return result;
    }
    const [, , id, endpoint, outputId] = segments;
    const params = Promise.resolve({ id });
    if (endpoint === "artifacts")
      return artifact(req, { params: Promise.resolve({ id, outputId }) });
    if (endpoint === "export-folder") return exportFolder(req, { params });
    return status(req, { params });
  }

  http = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = chunks.length
        ? new Uint8Array(Buffer.concat(chunks))
        : undefined;
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const req = new NextRequest(
        `http://${incoming.headers.host}${incoming.url}`,
        {
          method: incoming.method,
          headers,
          body,
        },
      );
      const result = await route(req);
      const content = Buffer.from(await result.arrayBuffer());
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      outgoing.end(content);
    } catch (error) {
      outgoing.writeHead(500, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: String(error) }));
    }
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  connectEngine({
    baseUrl: `http://127.0.0.1:${(http.address() as AddressInfo).port}`,
    secret: readOrCreateLocalSecret(),
  });
  registerCoreTools(mcp);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await mcp.connect(serverTransport);
  await client.connect(clientTransport);
}, 60_000);

afterAll(async () => {
  await client.close();
  await mcp.close();
  if (http?.listening) {
    http.close();
    await once(http, "close");
  }
  await prisma?.$disconnect();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
  for (const id of rendered) {
    for (const suffix of [
      ".mp4",
      ".contact-sheet.jpg",
      ".audio-mastering.json",
    ])
      rmSync(path.join("media", "renders", `render-${id}${suffix}`), {
        force: true,
      });
    rmSync(path.join("media", "exports", `render-${id}`), {
      recursive: true,
      force: true,
    });
  }
});

function storyboard(title: string) {
  return {
    version: 1,
    title,
    format: "9:16",
    music: "none",
    sfx: "off",
    voice: { enabled: false },
    captions: "off",
    scenes: [
      {
        type: "statement",
        headline: "Why the sky is blue",
        narration: "Air scatters blue light.",
      },
    ],
  };
}

function resultJson(result: Awaited<ReturnType<Client["callTool"]>>) {
  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  const { text } = z
    .object({ type: z.literal("text"), text: z.string() })
    .parse(first);
  return JSON.parse(text) as unknown;
}

const queued = z.object({ jobId: z.string(), state: z.literal("queued") });
const failure = z.object({
  state: z.literal("failed"),
  failure: z.object({ stage: z.string(), cause: z.string(), fix: z.string() }),
});

const cases = [
  { stage: "validate", cause: /quality:/, fix: /reel:\/\/storyboard\/schema/ },
  {
    stage: "plan",
    fault: "Scene 1 has conflicting order",
    cause: /conflicting order/,
    fix: /scenes, their order/,
  },
  {
    stage: "resolve_media",
    fault: "Scene 1 image file is missing",
    cause: /image file is missing/,
    fix: /local Library asset/,
  },
  {
    stage: "synthesize_audio",
    fault: "Kokoro voice model missing",
    cause: /voice model missing/,
    fix: /npm run voice:download/,
  },
  {
    stage: "time_content",
    cause: /supports up to 1 seconds/,
    fix: /shorten the narration/,
  },
  {
    stage: "prepare_composition",
    fault: "Scene 1 has no layout data",
    cause: /no layout data/,
    fix: /plain statement scene/,
  },
  {
    stage: "render_export",
    fault: "Chrome could not start",
    cause: /Chrome could not start/,
    fix: /REEL_VERIFY_CHROME/,
  },
  {
    stage: "verify_artifacts",
    fault: "MP4 audio track was unreadable",
    cause: /audio track was unreadable/,
    fix: /export a fresh copy/,
  },
] satisfies {
  stage: ProductionStepKey;
  fault?: string;
  cause: RegExp;
  fix: RegExp;
}[];

async function checkFailure({
  stage,
  fault,
  cause,
  fix,
}: (typeof cases)[number]) {
  const { jobId } = queued.parse(
    resultJson(
      await client.callTool({
        name: "create_video",
        arguments: {
          storyboard: storyboard(`MCP failure ${stage}`),
          quality: "draft",
          wait: false,
        },
      }),
    ),
  );
  const job = await prisma.productionJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  const input = z
    .object({ renderId: z.string() })
    .passthrough()
    .parse(JSON.parse(job.inputSnapshot));
  if (stage === "verify_artifacts") rendered.add(input.renderId);
  if (stage === "validate" || stage === "time_content") {
    await prisma.productionJob.update({
      where: { id: jobId },
      data: {
        inputSnapshot: JSON.stringify({
          ...input,
          ...(stage === "validate"
            ? { quality: "invalid" }
            : { maxDurationSeconds: 1 }),
        }),
      },
    });
  }
  expect(
    await runWorker({
      workerId: "mcp-failure-test",
      supervised: true,
      execute: (job, context) =>
        execute(job, {
          ...context,
          beforeStage: (key) => {
            if (fault && key === stage) throw new Error(fault);
          },
        }),
    }),
  ).toBe("failed");
  const get = await client.callTool({ name: "get_job", arguments: { jobId } });
  const reported = failure.parse(resultJson(get)).failure;
  expect(reported.stage).toBe(stage);
  expect(reported.cause).toMatch(cause);
  expect(reported.fix).toMatch(fix);
  const steps = await prisma.productionJobStep.findMany({ where: { jobId } });
  expect(
    Object.fromEntries(steps.map((step) => [step.key, step.state])),
  ).toEqual(
    Object.fromEntries(
      PRODUCTION_STEP_KEYS.slice(
        0,
        PRODUCTION_STEP_KEYS.indexOf(stage) + 1,
      ).map((key) => [key, key === stage ? "failed" : "succeeded"]),
    ),
  );
  expect(
    await prisma.productionJobOutput.count({ where: { jobId, kind: "video" } }),
  ).toBe(0);
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      path.join(evidence, `${stage}.json`),
      JSON.stringify(reported, null, 2),
    );
  }
}

it("returns structured validation guidance for an invalid submission", async () => {
  const result = await client.callTool({
    name: "create_video",
    arguments: {
      storyboard: { ...storyboard("Invalid storyboard"), scenes: [] },
      wait: false,
    },
  });
  expect(result.isError).toBe(true);
  expect(failure.parse(resultJson(result)).failure).toMatchObject({
    stage: "validate",
    cause: expect.stringMatching(/scenes/i),
    fix: expect.stringContaining("reel://storyboard/schema"),
  });
});

it.each(cases.slice(0, -1))(
  "reports the exact $stage failure to the MCP client",
  checkFailure,
);

it.runIf(realRender)(
  "reports verify_artifacts failure after a real export",
  async () => {
    await checkFailure(cases[cases.length - 1]);
  },
  120_000,
);

it.runIf(realRender)(
  "receives MCP progress, an actual contact sheet and a file path",
  async () => {
    let worker: ReturnType<typeof runWorker> | undefined;
    const progress: { progress: number; message?: string }[] = [];
    onSubmit = () => {
      worker = runWorker({
        workerId: "mcp-preview-test",
        supervised: true,
        execute: (job, context) => {
          const input = z
            .object({ renderId: z.string() })
            .parse(job.inputSnapshot);
          rendered.add(input.renderId);
          return execute(job, {
            ...context,
            beforeStage: async (key) => {
              if (key === "render_export") await delay(4_000);
            },
          });
        },
      });
    };
    try {
      const result = await client.callTool(
        {
          name: "create_video",
          arguments: {
            storyboard: storyboard("MCP contact sheet"),
            quality: "draft",
            waitSeconds: 90,
          },
        },
        undefined,
        {
          onprogress: (value) => {
            progress.push(value);
          },
          timeout: 105_000,
        },
      );
      expect(await worker).toBe("succeeded");
      const output = z
        .object({ state: z.literal("succeeded"), filePath: z.string() })
        .parse(resultJson(result));
      expect(existsSync(output.filePath)).toBe(true);
      expect(progress).toContainEqual(
        expect.objectContaining({ message: "rendering", total: 100 }),
      );
      expect(progress.at(-1)?.progress).toBe(100);
      const [, image] = z
        .tuple([
          z.unknown(),
          z.object({
            type: z.literal("image"),
            data: z.string(),
            mimeType: z.literal("image/jpeg"),
          }),
        ])
        .parse(result.content);
      const jpeg = Buffer.from(image.data, "base64");
      expect(jpeg.subarray(0, 3).toString("hex")).toBe("ffd8ff");
      if (evidence) {
        mkdirSync(evidence, { recursive: true });
        writeFileSync(path.join(evidence, "contact-sheet.jpg"), jpeg);
        writeFileSync(
          path.join(evidence, "progress.json"),
          JSON.stringify(
            { progress, mp4Exists: true, contactSheetBytes: jpeg.length },
            null,
            2,
          ),
        );
      }
    } finally {
      onSubmit = undefined;
      await worker;
    }
  },
  120_000,
);
