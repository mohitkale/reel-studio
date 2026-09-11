import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import selectionJson from "../src/engines/hyperframes/catalog/selection.json";
import {
  assertSelectionMatchesItem,
  catalogSelectionSchema,
  importedCatalogSchema,
  registryDirectory,
  sha256,
  upstreamRegistryIndexSchema,
  upstreamRegistryItemSchema,
  type ImportedCatalog,
} from "../src/engines/hyperframes/catalog/importer";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const selection = catalogSelectionSchema.parse(selectionJson);
const rawRoot = `https://raw.githubusercontent.com/heygen-com/hyperframes/${selection.revision}/registry`;
const outputRoot = path.join(
  projectRoot,
  "src/engines/hyperframes/catalog/versions",
  selection.revision,
);

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url));
}

function serialized(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const registryText = await fetchText(`${rawRoot}/registry.json`);
  const registry = upstreamRegistryIndexSchema.parse(JSON.parse(registryText));
  const registryTypes = new Map(
    registry.items.map((item) => [item.name, item.type]),
  );
  const importedItems: ImportedCatalog["items"] = [];
  const downloadedFiles = new Map<string, Uint8Array>();

  for (const selected of selection.items) {
    const indexedType = registryTypes.get(selected.name);
    const expectedType = `hyperframes:${selected.type}`;
    if (indexedType !== expectedType) {
      throw new Error(
        `Registry index does not expose ${selected.name} as ${expectedType}`,
      );
    }

    const directory = registryDirectory(selected.type);
    const itemRoot = `${rawRoot}/${directory}/${selected.name}`;
    const itemText = await fetchText(`${itemRoot}/registry-item.json`);
    const item = upstreamRegistryItemSchema.parse(JSON.parse(itemText));
    assertSelectionMatchesItem(selected, item);

    const files = [];
    for (const file of item.files) {
      const content = await fetchBytes(`${itemRoot}/${file.path}`);
      const outputPath = path.posix.join(directory, selected.name, file.path);
      downloadedFiles.set(outputPath, content);
      files.push({
        ...file,
        path: outputPath,
        checksum: sha256(content),
        bytes: content.byteLength,
      });
    }

    importedItems.push({
      name: item.name,
      type: selected.type,
      templateId: selected.templateId,
      title: item.title,
      description: item.description,
      tags: item.tags,
      author: item.author,
      authorUrl: item.authorUrl,
      license: item.license ?? selection.license,
      attribution: item.author
        ? `${item.title} by ${item.author} (${selection.source})`
        : `${item.title} from the HyperFrames catalog (${selection.source})`,
      minCliVersion: item.minCliVersion,
      dimensions: item.dimensions,
      duration: item.duration,
      registryDependencies: item.registryDependencies,
      presets: selected.presets,
      supportedLayouts: selected.layouts,
      registryItemChecksum: sha256(itemText),
      files,
    });
  }

  const manifest = importedCatalogSchema.parse({
    schemaVersion: 1,
    source: selection.source,
    sourceRevision: selection.revision,
    registryChecksum: sha256(registryText),
    items: importedItems,
  });
  const manifestText = serialized(manifest);
  const existingManifest = await fs
    .readFile(path.join(outputRoot, "catalog.json"), "utf8")
    .catch(() => null);
  if (existingManifest !== null && existingManifest !== manifestText) {
    throw new Error(
      `Immutable catalog revision ${selection.revision} already exists with different content`,
    );
  }

  for (const [relativePath, content] of downloadedFiles) {
    const absolutePath = path.join(outputRoot, relativePath);
    const relativeCheck = path.relative(outputRoot, absolutePath);
    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      throw new Error(
        `Refusing to write outside catalog version: ${relativePath}`,
      );
    }
    const existing = await fs.readFile(absolutePath).catch(() => null);
    if (existing && sha256(existing) !== sha256(content)) {
      throw new Error(`Immutable catalog file changed: ${relativePath}`);
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(
    path.join(outputRoot, "catalog.json"),
    manifestText,
    "utf8",
  );
  console.log(
    `Imported ${manifest.items.length} catalog items at ${manifest.sourceRevision}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
