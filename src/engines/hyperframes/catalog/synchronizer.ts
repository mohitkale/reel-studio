import path from "node:path";

import {
  assertSelectionMatchesItem,
  catalogCapabilityManifestSchema,
  importedCatalogSchema,
  registryDirectory,
  sha256,
  unsupportedCatalogReportSchema,
  upstreamRegistryIndexSchema,
  upstreamRegistryItemSchema,
  type CatalogCapabilityManifest,
  type CatalogSelection,
  type ImportedCatalog,
  type UnsupportedCatalogReport,
} from "@/engines/hyperframes/catalog/importer";

export type CatalogFetch = (url: string) => Promise<Uint8Array>;

export interface CatalogSyncBundle {
  catalog: ImportedCatalog;
  capabilities: CatalogCapabilityManifest;
  unsupported: UnsupportedCatalogReport;
  files: ReadonlyMap<string, Uint8Array>;
}

const textDecoder = new TextDecoder();
const GSAP_CDN_URL =
  "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
const ALLOWED_OFFLINE_URLS = [
  GSAP_CDN_URL,
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "http://www.w3.org/2000/svg",
] as const;

function decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isTextFile(filePath: string): boolean {
  return /\.(?:css|html|js|json|mjs|svg|txt)$/i.test(filePath);
}

function assertImageMagic(filePath: string, bytes: Uint8Array): void {
  const lower = filePath.toLowerCase();
  if (/\.jpe?g$/.test(lower)) {
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      throw new Error(`Catalog asset has invalid JPEG bytes: ${filePath}`);
    }
    return;
  }
  if (/\.png$/.test(lower)) {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!signature.every((value, index) => bytes[index] === value)) {
      throw new Error(`Catalog asset has invalid PNG bytes: ${filePath}`);
    }
    return;
  }
  if (/\.webp$/.test(lower)) {
    if (
      decode(bytes.slice(0, 4)) !== "RIFF" ||
      decode(bytes.slice(8, 12)) !== "WEBP"
    ) {
      throw new Error(`Catalog asset has invalid WebP bytes: ${filePath}`);
    }
  }
}

function assertAssetSource(url: string): void {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "static.heygen.ai" ||
    !parsed.pathname.startsWith("/hyperframes-oss/registry-assets/")
  ) {
    throw new Error(`Catalog asset source is not approved for sync: ${url}`);
  }
}

function inspectOfflineHtml(
  itemName: string,
  filePath: string,
  content: string,
  declaredAssetPaths: ReadonlySet<string>,
): Array<"google-fonts" | "gsap"> {
  const rewrites = new Set<"google-fonts" | "gsap">();
  for (const match of content.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    const url = match[0];
    if (url.startsWith("https://fonts.google")) {
      rewrites.add("google-fonts");
      continue;
    }
    if (url === GSAP_CDN_URL) {
      rewrites.add("gsap");
      continue;
    }
    if (ALLOWED_OFFLINE_URLS.some((allowed) => url.startsWith(allowed))) {
      continue;
    }
    throw new Error(
      `Catalog item ${itemName} has an unsupported network URL in ${filePath}: ${url}`,
    );
  }

  const referencedAssets = new Set<string>();
  for (const match of content.matchAll(/["'`](assets\/[^"'`?#)\s]+)/g)) {
    referencedAssets.add(match[1]);
  }
  for (const assetPath of referencedAssets) {
    const declaredDirectory =
      assetPath.endsWith("/") &&
      [...declaredAssetPaths].some((declared) =>
        declared.startsWith(assetPath),
      );
    if (!declaredAssetPaths.has(assetPath) && !declaredDirectory) {
      throw new Error(
        `Catalog item ${itemName} references an undeclared asset in ${filePath}: ${assetPath}`,
      );
    }
  }
  return [...rewrites].sort();
}

function unsupportedReason(type: string, releaseTag: string): string {
  if (type === "hyperframes:example") {
    return "Registry examples are project scaffolds and cannot be embedded as production catalog items.";
  }
  if (type === "hyperframes:component") {
    return `Component is outside the reviewed Reel Studio selection for ${releaseTag}; dependency and host integration review is required.`;
  }
  return `Block is outside the reviewed Reel Studio selection for ${releaseTag}; responsive, seek, media, and render review is required.`;
}

function registryCounts(items: Array<{ type: string }>) {
  return {
    blocks: items.filter((item) => item.type === "hyperframes:block").length,
    components: items.filter((item) => item.type === "hyperframes:component")
      .length,
    examples: items.filter((item) => item.type === "hyperframes:example")
      .length,
  };
}

export async function buildCatalogSyncBundle(
  selection: CatalogSelection,
  fetchBytes: CatalogFetch,
): Promise<CatalogSyncBundle> {
  const rawRoot = `https://raw.githubusercontent.com/heygen-com/hyperframes/${selection.revision}/registry`;
  const registryBytes = await fetchBytes(`${rawRoot}/registry.json`);
  const registry = upstreamRegistryIndexSchema.parse(
    JSON.parse(decode(registryBytes)),
  );
  const registryByName = new Map(
    registry.items.map((item) => [item.name, item] as const),
  );
  const selectedNames = new Set(selection.items.map((item) => item.name));
  const files = new Map<string, Uint8Array>();
  const importedItems: ImportedCatalog["items"] = [];
  const capabilityItems: CatalogCapabilityManifest["items"] = [];

  for (const selected of selection.items) {
    const indexed = registryByName.get(selected.name);
    if (!indexed) {
      throw new Error(
        `Registry does not contain selected item: ${selected.name}`,
      );
    }
    const expectedType = `hyperframes:${selected.type}`;
    if (indexed.type !== expectedType) {
      throw new Error(
        `Registry index exposes ${selected.name} as ${indexed.type}, expected ${expectedType}`,
      );
    }

    const directory = registryDirectory(selected.type);
    const itemRoot = `${rawRoot}/${directory}/${selected.name}`;
    const itemBytes = await fetchBytes(`${itemRoot}/registry-item.json`);
    const item = upstreamRegistryItemSchema.parse(
      JSON.parse(decode(itemBytes)),
    );
    assertSelectionMatchesItem(selected, item);
    for (const dependency of item.registryDependencies) {
      if (!registryByName.has(dependency)) {
        throw new Error(
          `Catalog item ${item.name} references missing dependency ${dependency}`,
        );
      }
      if (!selectedNames.has(dependency)) {
        throw new Error(
          `Catalog item ${item.name} requires unselected dependency ${dependency}`,
        );
      }
    }

    const declaredAssetPaths = new Set(
      item.files
        .filter((file) => file.type === "hyperframes:asset")
        .map((file) => file.path),
    );
    const runtimeRewrites = new Set<"google-fonts" | "gsap">();
    const importedFiles = [];
    for (const file of item.files) {
      if (file.url) assertAssetSource(file.url);
      const content = await fetchBytes(file.url ?? `${itemRoot}/${file.path}`);
      if (content.byteLength === 0) {
        throw new Error(`Catalog file is empty: ${item.name}/${file.path}`);
      }
      if (file.type === "hyperframes:asset") {
        assertImageMagic(file.path, content);
      }
      if (isTextFile(file.path)) {
        for (const rewrite of inspectOfflineHtml(
          item.name,
          file.path,
          decode(content),
          declaredAssetPaths,
        )) {
          runtimeRewrites.add(rewrite);
        }
      }
      const outputPath = path.posix.join(directory, selected.name, file.path);
      const embedded = selected.integration === "vendored";
      if (embedded) files.set(outputPath, content);
      importedFiles.push({
        ...file,
        path: outputPath,
        checksum: sha256(content),
        bytes: content.byteLength,
        embedded,
      });
    }

    importedItems.push({
      name: item.name,
      type: selected.type,
      templateId: selected.templateId,
      integration: selected.integration,
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
      variables: item.variables,
      presets: selected.presets,
      supportedLayouts: selected.layouts,
      registryItemChecksum: sha256(itemBytes),
      files: importedFiles,
    });

    capabilityItems.push({
      capabilityId: `hf.catalog.${selected.type}.${selected.name}`,
      registryName: selected.name,
      type: selected.type,
      templateId: selected.templateId,
      integration: selected.integration,
      tags: item.tags,
      presets: selected.presets,
      layouts: selected.layouts,
      variableIds: item.variables.map((variable) => variable.id),
      requiredLocalMedia: [
        ...new Set(
          item.variables
            .map((variable) => variable.type)
            .filter(
              (type): type is "image" | "video" | "audio" =>
                type === "image" || type === "video" || type === "audio",
            ),
        ),
      ].sort(),
      offlineReady: true,
      runtimeRewrites: [...runtimeRewrites].sort(),
    });
  }

  const catalog = importedCatalogSchema.parse({
    schemaVersion: 2,
    source: selection.source,
    releaseTag: selection.releaseTag,
    sourceRevision: selection.revision,
    packages: selection.packages,
    registryChecksum: sha256(registryBytes),
    items: importedItems,
  });
  const capabilities = catalogCapabilityManifestSchema.parse({
    schemaVersion: 1,
    releaseTag: selection.releaseTag,
    sourceRevision: selection.revision,
    packages: selection.packages,
    registryCounts: registryCounts(registry.items),
    items: capabilityItems,
  });
  const unsupported = unsupportedCatalogReportSchema.parse({
    schemaVersion: 1,
    releaseTag: selection.releaseTag,
    sourceRevision: selection.revision,
    items: registry.items
      .filter((item) => !selectedNames.has(item.name))
      .map((item) => ({
        name: item.name,
        type: item.type,
        reason: unsupportedReason(item.type, selection.releaseTag),
      }))
      .sort((a, b) =>
        `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`),
      ),
  });

  files.set("catalog.json", new TextEncoder().encode(serialize(catalog)));
  files.set(
    "capabilities.json",
    new TextEncoder().encode(serialize(capabilities)),
  );
  files.set(
    "unsupported.json",
    new TextEncoder().encode(serialize(unsupported)),
  );
  return { catalog, capabilities, unsupported, files };
}
