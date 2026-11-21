import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { assertPathInsideRoot } from "../src/server/url-safety";

const https = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password;
}, "Use an HTTPS URL without credentials");
const file = z.object({
  path: z
    .string()
    .max(240)
    .regex(/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const artifact = file
  .extend({
    kind: z.enum(["weights", "data"]),
    source: https,
    revision: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  })
  .strict()
  .superRefine((value, ctx) => {
    const valid =
      value.kind === "weights"
        ? /\.(?:onnx|safetensors)$/.test(value.path)
        : /\.(?:json|model|txt|tiktoken)$/.test(value.path);
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["path"],
        message:
          "Weights must use .onnx or .safetensors. Data must use a supported configuration or tokenizer format.",
      });
    if (
      !URL.canParse(value.source) ||
      !new URL(value.source).pathname.split("/").includes(value.revision)
    )
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "The HTTPS source path must contain the immutable revision.",
      });
  });

const manifestSchema = z.strictObject({
  model: z.string().trim().min(1).max(160),
  artifacts: z
    .array(artifact)
    .min(1)
    .max(64)
    .refine(
      (values) => values.some(({ kind }) => kind === "weights"),
      "At least one weights file is required",
    ),
  terms: z.strictObject({
    code: https,
    weights: https,
    trainingData: z.array(https).min(1).max(32),
    commercialUseAllowed: z.literal(true),
    delivery: z.literal("optional-download"),
  }),
  runtime: z.strictObject({
    bindHost: z.literal("127.0.0.1"),
    outboundNetwork: z.literal(false),
    writesOutsideData: z.literal(false),
    trustRemoteCode: z.literal(false),
    runtimeDownloads: z.literal(false),
    evidence: https,
  }),
  audits: z.strictObject({
    app: https,
    sidecar: https,
    lockfile: file.strict(),
  }),
  referenceAudio: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("none") }),
    z.strictObject({ kind: z.literal("consented"), evidence: https }),
  ]),
});

/** Check a reviewed local manifest without running or changing its files. */
export async function verifyVoiceGate(manifestPath: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const root = await realpath(path.dirname(path.resolve(manifestPath)));
  const files = [...manifest.artifacts, manifest.audits.lockfile];
  const paths = files.map((entry) => entry.path.toLowerCase());
  if (new Set(paths).size !== paths.length)
    throw new Error("Each staged file must have a distinct path.");
  for (const entry of files) {
    const filename = assertPathInsideRoot(
      root,
      await realpath(path.join(root, entry.path)),
    );
    const details = await stat(filename);
    if (!details.isFile() || details.size === 0)
      throw new Error(`${entry.path} must be a nonempty regular file.`);
    const hash = createHash("sha256");
    for await (const block of createReadStream(filename)) hash.update(block);
    if (hash.digest("hex") !== entry.sha256)
      throw new Error(`SHA-256 mismatch for ${entry.path}.`);
  }
  return { model: manifest.model, files: files.length };
}

async function main() {
  const [manifestPath, ...extra] = process.argv.slice(2);
  if (!manifestPath || extra.length)
    throw new Error("Usage: npm run voice:gate -- <model-manifest.json>");
  const result = await verifyVoiceGate(manifestPath);
  console.log(
    `Verified ${result.files} staged file checksums and required evidence fields for ${result.model}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
