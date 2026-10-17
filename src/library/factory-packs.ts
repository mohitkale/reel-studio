import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import runtime from "../../public/reel-runtime/manifest.json";
import { ADAPTIVE_MANIFESTS } from "@/video/adaptive-catalog";
import { COMPATIBILITY_RECIPE, filmDigest } from "@/production/film-plan";
import { CURRENT_HF_CATALOG_REVISION } from "@/engines/hyperframes/catalog/versions";
import { catalogRevisionIncludes } from "@/engines/hyperframes/catalog/revisions";
import { getAssetStore } from "@/library/storage";
import { prisma } from "@/library/db";
import { FACTORY_LIMITS } from "@/production/factory";
import { ProviderError } from "@/providers/voice/types";
import type { ProductionBundleEntry } from "@/library/production-bundle";
const digest = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
const manifests = [COMPATIBILITY_RECIPE, ...ADAPTIVE_MANIFESTS];
export const factoryPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    key: z.literal("adaptive-core"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    catalogRevision: z.string().min(1),
    recipes: z
      .array(
        z
          .object({
            id: z.string(),
            version: z.string(),
            hash: z.string(),
            manifest: z.unknown(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    assets: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z.number().int().positive().max(FACTORY_LIMITS.packBytes),
          })
          .strict(),
      )
      .min(1)
      .max(150),
    licenses: z
      .array(
        z
          .object({ name: z.string(), license: z.string(), notice: z.string() })
          .strict(),
      )
      .max(20),
    compatibility: z.literal("reel-studio-adaptive-v1"),
  })
  .strict();
export type FactoryPack = z.infer<typeof factoryPackSchema>;
export async function ensureFactoryPack() {
  const assets: FactoryPack["assets"] = [],
    files = new Map<string, Buffer>();
  const sources = [
    ...runtime.assets.map((item) => ({
      name: item.filename,
      filename: path.join("public/reel-runtime", item.filename),
      expected: item.sha256,
    })),
    ...runtime.sources
      .filter((source) => !source.notice.startsWith("http"))
      .map((source) => ({
        name: source.notice,
        filename: path.join("public/reel-runtime", source.notice),
        expected: undefined,
      })),
    {
      name: "reel-studio-LICENSE.txt",
      filename: "LICENSE",
      expected: undefined,
    },
    {
      name: "gsap-NOTICE.txt",
      filename: "public/reel-runtime/gsap.min.js",
      expected: undefined,
    },
  ];
  for (const item of sources) {
    const raw = await readFile(item.filename);
    const data =
        item.name === "gsap-NOTICE.txt"
          ? raw.subarray(0, raw.indexOf("*/") + 2)
          : raw,
      hash = digest(data);
    if (item.expected && hash !== item.expected)
      throw new ProviderError("Bundled runtime integrity check failed", 409);
    files.set(item.name, data);
    assets.push({ name: item.name, sha256: hash, bytes: data.length });
  }
  if (assets.reduce((sum, a) => sum + a.bytes, 0) > FACTORY_LIMITS.packBytes)
    throw new ProviderError("Pack exceeds 64 MiB", 400);
  const manifest = factoryPackSchema.parse({
    schemaVersion: 1,
    key: "adaptive-core",
    version: "1.0.0",
    catalogRevision: CURRENT_HF_CATALOG_REVISION,
    recipes: manifests.map((manifest) => ({
      id: manifest.id,
      version: manifest.version,
      hash: filmDigest(manifest),
      manifest,
    })),
    assets,
    licenses: [
      {
        name: "Reel Studio adaptive recipes",
        license: "MIT",
        notice: "reel-studio-LICENSE.txt",
      },
      ...runtime.sources.map((source) => ({
        name: source.package,
        license: source.license,
        notice: source.notice.startsWith("http")
          ? "gsap-NOTICE.txt"
          : source.notice,
      })),
    ],
    compatibility: "reel-studio-adaptive-v1",
  });
  const hash = filmDigest(manifest),
    prior = await prisma.factoryPack.findUnique({
      where: { key_version: { key: manifest.key, version: manifest.version } },
    });
  if (!prior && (await prisma.factoryPack.count()) >= FACTORY_LIMITS.packs)
    throw new ProviderError("The 20-version pack storage budget is full", 409);
  if (prior && prior.digest !== hash)
    throw new ProviderError(
      "Bundled pack changed without a version increment",
      409,
    );
  for (const [name, data] of files) {
    const key = `factory-packs/${hash.slice(7)}/${name}`;
    if (!(await getAssetStore().exists(key)))
      await getAssetStore().put(key, data);
  }
  await prisma.factoryPack.upsert({
    where: { digest: hash },
    update: {},
    create: {
      digest: hash,
      key: manifest.key,
      version: manifest.version,
      manifestJson: JSON.stringify(manifest),
    },
  });
  return { digest: hash, manifest };
}
export async function readFactoryPack(hash: string) {
  if (!/^sha256:[a-f0-9]{64}$/.test(hash))
    throw new ProviderError("Invalid pack digest", 400);
  const row = await prisma.factoryPack.findUnique({ where: { digest: hash } });
  if (!row) throw new ProviderError("Pinned pack is unavailable", 404);
  const manifest = factoryPackSchema.parse(JSON.parse(row.manifestJson));
  if (filmDigest(manifest) !== hash)
    throw new ProviderError("Pinned pack manifest changed", 409);
  return manifest;
}
export async function verifyFactoryPack(hash: string) {
  const manifest = await readFactoryPack(hash);
  if (
    !catalogRevisionIncludes(
      CURRENT_HF_CATALOG_REVISION,
      manifest.catalogRevision,
    ) ||
    manifest.recipes.some(
      (recipe) =>
        !manifests.some(
          (current) =>
            current.id === recipe.id &&
            current.version === recipe.version &&
            filmDigest(current) === recipe.hash,
        ),
    )
  )
    throw new ProviderError(
      "Pinned pack needs a compatible installed renderer",
      409,
    );
  let bytes = 0;
  for (const asset of manifest.assets) {
    bytes += asset.bytes;
    if (bytes > FACTORY_LIMITS.packBytes)
      throw new ProviderError("Pack exceeds 64 MiB", 400);
    const data = await getAssetStore().get(
      `factory-packs/${hash.slice(7)}/${asset.name}`,
    );
    if (data.length !== asset.bytes || digest(data) !== asset.sha256)
      throw new ProviderError(
        "Pinned pack asset failed integrity verification",
        409,
      );
  }
  return manifest;
}
export async function factoryPackEntries(
  hash: string,
): Promise<ProductionBundleEntry[]> {
  const manifest = await verifyFactoryPack(hash),
    time = new Date(0),
    content = Buffer.from(JSON.stringify(manifest, null, 2));
  return [
    { name: "pack.json", content, size: content.length, modifiedAt: time },
    ...(await Promise.all(
      manifest.assets.map(async (asset) => ({
        name: asset.name,
        content: await getAssetStore().get(
          `factory-packs/${hash.slice(7)}/${asset.name}`,
        ),
        size: asset.bytes,
        modifiedAt: time,
      })),
    )),
  ];
}

/** The archive path is derived only from a validated digest; external paths never enter this copy. */
export async function copyFactoryRuntime(hash: string, directory: string) {
  const manifest = await verifyFactoryPack(hash);
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(directory, { recursive: true });
  for (const asset of manifest.assets)
    await writeFile(
      path.join(directory, asset.name),
      await getAssetStore().get(`factory-packs/${hash.slice(7)}/${asset.name}`),
    );
}
