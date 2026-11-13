import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import selectionJson from "@/engines/hyperframes/catalog/selection.json";
import {
  assertSelectionMatchesItem,
  catalogSelectionSchema,
  importedCatalogSchema,
  sha256,
  upstreamRegistryItemSchema,
} from "@/engines/hyperframes/catalog/importer";
import {
  CURRENT_HF_CATALOG,
  CURRENT_HF_CATALOG_CAPABILITIES,
  CURRENT_HF_CATALOG_REVISION,
  CURRENT_HF_UNSUPPORTED_CATALOG,
  HF_CATALOG_VERSIONS,
  LEGACY_HF_CATALOG_REVISION,
  PREVIOUS_HF_CATALOG_REVISION,
  getCatalogVersion,
} from "@/engines/hyperframes/catalog/versions";

const versionRoot = path.join(
  process.cwd(),
  "src/engines/hyperframes/catalog/versions",
  CURRENT_HF_CATALOG_REVISION,
);

describe("HyperFrames catalog import", () => {
  it("pins and validates every curated item at one upstream revision", () => {
    const selection = catalogSelectionSchema.parse(selectionJson);
    const catalog = importedCatalogSchema.parse(CURRENT_HF_CATALOG);

    expect(catalog.sourceRevision).toBe(selection.revision);
    expect(catalog.items.map((item) => item.name)).toEqual(
      selection.items.map((item) => item.name),
    );
    for (const item of catalog.items) {
      expect(item.attribution).toContain(selection.source);
      expect(item.license).toBeTruthy();
      if (item.type === "block") {
        expect(item.templateId).toMatch(/^hf-.+-v\d+$/);
        expect(item.dimensions).toBeDefined();
        expect(item.duration).toBeGreaterThan(0);
      } else {
        expect(item.templateId).toBeUndefined();
        expect(item.dimensions).toBeUndefined();
        expect(item.duration).toBeUndefined();
      }
    }
  });

  it("verifies every vendored file against its recorded checksum", async () => {
    for (const item of CURRENT_HF_CATALOG.items) {
      for (const file of item.files) {
        if (!file.embedded) continue;
        const content = await readFile(path.join(versionRoot, file.path));
        expect(content.byteLength).toBe(file.bytes);
        expect(sha256(content)).toBe(file.checksum);
      }
    }
  });

  it("retains the legacy catalog alongside the current catalog", () => {
    expect(HF_CATALOG_VERSIONS.map((version) => version.revision)).toEqual([
      LEGACY_HF_CATALOG_REVISION,
      PREVIOUS_HF_CATALOG_REVISION,
      CURRENT_HF_CATALOG_REVISION,
    ]);
    expect(getCatalogVersion(LEGACY_HF_CATALOG_REVISION)?.status).toBe(
      "legacy",
    );
    expect(getCatalogVersion(PREVIOUS_HF_CATALOG_REVISION)?.status).toBe(
      "legacy",
    );
    expect(getCatalogVersion(CURRENT_HF_CATALOG_REVISION)?.status).toBe(
      "current",
    );
  });

  it("exposes only reviewed carousel capabilities through native adapters", () => {
    const names = [
      "carousel-circle-1",
      "carousel-path-1",
      "carousel-vision-1",
    ];
    const capabilities = CURRENT_HF_CATALOG_CAPABILITIES.items.filter((item) =>
      names.includes(item.registryName),
    );

    expect(capabilities).toHaveLength(3);
    expect(capabilities.every((item) => item.integration === "native-adapter"))
      .toBe(true);
    expect(
      capabilities.every(
        (item) => item.requiredLocalMedia.join(",") === "image",
      ),
    ).toBe(true);
    expect(
      CURRENT_HF_UNSUPPORTED_CATALOG.items.some((item) =>
        names.includes(item.name),
      ),
    ).toBe(false);
    expect(
      CURRENT_HF_CATALOG.items
        .filter((item) => names.includes(item.name))
        .flatMap((item) => item.files)
        .every((file) => !file.embedded),
    ).toBe(true);
  });

  it("rejects traversal and block/component mismatches", () => {
    const unsafe = upstreamRegistryItemSchema.safeParse({
      name: "unsafe",
      type: "hyperframes:component",
      title: "Unsafe",
      description: "Unsafe path fixture",
      files: [
        {
          path: "../outside.html",
          target: "compositions/components/unsafe.html",
          type: "hyperframes:snippet",
        },
      ],
    });
    expect(unsafe.success).toBe(false);

    const component = upstreamRegistryItemSchema.parse({
      name: "caption-pill-karaoke",
      type: "hyperframes:component",
      title: "Pill Karaoke",
      description: "Caption component",
      files: [
        {
          path: "caption-pill-karaoke.html",
          target: "compositions/components/caption-pill-karaoke.html",
          type: "hyperframes:snippet",
        },
      ],
    });
    expect(() =>
      assertSelectionMatchesItem(
        {
          name: component.name,
          type: "block",
          templateId: "hf-caption-pill-v1",
          integration: "vendored",
          presets: ["creator-punch"],
          layouts: ["portrait"],
        },
        component,
      ),
    ).toThrow(/expected hyperframes:block/);
  });
});
