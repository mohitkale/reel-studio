import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import selectionJson from "../src/engines/hyperframes/catalog/selection.json";
import { catalogSelectionSchema } from "../src/engines/hyperframes/catalog/importer";
import { buildCatalogSyncBundle } from "../src/engines/hyperframes/catalog/synchronizer";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const versionsRoot = path.join(
  projectRoot,
  "src/engines/hyperframes/catalog/versions",
);

async function fetchBytes(url: string): Promise<Uint8Array> {
  const parsed = new URL(url);
  const allowed =
    parsed.hostname === "raw.githubusercontent.com" ||
    (parsed.hostname === "static.heygen.ai" &&
      parsed.pathname.startsWith("/hyperframes-oss/registry-assets/"));
  if (parsed.protocol !== "https:" || !allowed) {
    throw new Error(`Catalog sync refused an unapproved URL: ${url}`);
  }
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status}): ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function readPackageVersion(packagePath: string): Promise<string> {
  const raw = JSON.parse(await fs.readFile(packagePath, "utf8")) as {
    version?: unknown;
  };
  if (typeof raw.version !== "string") {
    throw new Error(`Package manifest has no version: ${packagePath}`);
  }
  return raw.version;
}

async function assertPackageTargets(
  selection: ReturnType<typeof catalogSelectionSchema.parse>,
): Promise<void> {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(projectRoot, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const targets = [
    {
      ...selection.packages.producer,
      declared: packageJson.dependencies?.[selection.packages.producer.name],
    },
    {
      ...selection.packages.cli,
      declared: packageJson.devDependencies?.[selection.packages.cli.name],
    },
  ];
  for (const target of targets) {
    if (target.declared !== target.version) {
      throw new Error(
        `${target.name} must be exact-pinned to ${target.version}; found ${target.declared ?? "missing"}`,
      );
    }
    const installed = await readPackageVersion(
      path.join(projectRoot, "node_modules", target.name, "package.json"),
    );
    if (installed !== target.version) {
      throw new Error(
        `${target.name} ${target.version} is selected but ${installed} is installed`,
      );
    }
  }
}

function assertInsideVersionRoot(outputRoot: string, relativePath: string) {
  const absolutePath = path.join(outputRoot, relativePath);
  const relativeCheck = path.relative(outputRoot, absolutePath);
  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error(
      `Refusing to write outside catalog version: ${relativePath}`,
    );
  }
  return absolutePath;
}

async function writeImmutableFile(
  outputRoot: string,
  relativePath: string,
  content: Uint8Array,
): Promise<"created" | "unchanged"> {
  const absolutePath = assertInsideVersionRoot(outputRoot, relativePath);
  const existing = await fs.readFile(absolutePath).catch(() => null);
  if (existing) {
    if (!existing.equals(content)) {
      throw new Error(
        `Immutable catalog revision contains different bytes: ${relativePath}`,
      );
    }
    return "unchanged";
  }
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
  return "created";
}

async function main() {
  const selection = catalogSelectionSchema.parse(selectionJson);
  await assertPackageTargets(selection);
  const bundle = await buildCatalogSyncBundle(selection, fetchBytes);
  const outputRoot = path.join(versionsRoot, selection.revision);
  let created = 0;
  let unchanged = 0;
  for (const [relativePath, content] of [...bundle.files].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const result = await writeImmutableFile(outputRoot, relativePath, content);
    if (result === "created") created += 1;
    else unchanged += 1;
  }
  console.log(
    [
      `Synced HyperFrames ${selection.releaseTag}`,
      `${bundle.catalog.items.length} reviewed items`,
      `${bundle.unsupported.items.length} unsupported items recorded`,
      `${created} files created`,
      `${unchanged} files unchanged`,
    ].join(" · "),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
