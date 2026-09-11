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
  CURRENT_HF_CATALOG_REVISION,
  HF_CATALOG_VERSIONS,
  LEGACY_HF_CATALOG_REVISION,
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
        const content = await readFile(path.join(versionRoot, file.path));
        expect(content.byteLength).toBe(file.bytes);
        expect(sha256(content)).toBe(file.checksum);
      }
    }
  });

  it("retains the legacy catalog alongside the current catalog", () => {
    expect(HF_CATALOG_VERSIONS.map((version) => version.revision)).toEqual([
      LEGACY_HF_CATALOG_REVISION,
      CURRENT_HF_CATALOG_REVISION,
    ]);
    expect(getCatalogVersion(LEGACY_HF_CATALOG_REVISION)?.status).toBe(
      "legacy",
    );
    expect(getCatalogVersion(CURRENT_HF_CATALOG_REVISION)?.status).toBe(
      "current",
    );
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
          presets: ["creator-punch"],
          layouts: ["portrait"],
        },
        component,
      ),
    ).toThrow(/expected hyperframes:block/);
  });
});
