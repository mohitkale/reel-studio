import { describe, expect, it } from "vitest";

import { catalogSelectionSchema } from "@/engines/hyperframes/catalog/importer";
import {
  buildCatalogSyncBundle,
  type CatalogFetch,
} from "@/engines/hyperframes/catalog/synchronizer";

const revision = "a".repeat(40);
const rawRoot = `https://raw.githubusercontent.com/heygen-com/hyperframes/${revision}/registry`;
const assetUrl =
  "https://static.heygen.ai/hyperframes-oss/registry-assets/example.png";
const encoder = new TextEncoder();

function bytes(value: unknown): Uint8Array {
  return encoder.encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
}

function fixtureFetch(
  overrides: Record<string, Uint8Array> = {},
): CatalogFetch {
  const registry = {
    name: "hyperframes",
    items: [
      { name: "reviewed-carousel", type: "hyperframes:block" },
      { name: "unreviewed-component", type: "hyperframes:component" },
      { name: "starter", type: "hyperframes:example" },
    ],
  };
  const item = {
    name: "reviewed-carousel",
    type: "hyperframes:block",
    title: "Reviewed carousel",
    description: "A deterministic local-image carousel.",
    tags: ["carousel", "images"],
    author: "HyperFrames",
    dimensions: { width: 1920, height: 1080 },
    duration: 6,
    variables: [
      {
        id: "image1",
        type: "image",
        role: "content",
        label: "Image",
        description: "Local card image.",
        default: "assets/example.png",
      },
    ],
    files: [
      {
        path: "reviewed-carousel.html",
        target: "compositions/reviewed-carousel.html",
        type: "hyperframes:composition",
      },
      {
        path: "assets/example.png",
        target: "assets/example.png",
        type: "hyperframes:asset",
        url: assetUrl,
      },
    ],
  };
  const html = `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Inter"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script></head><body><img src="assets/example.png"></body></html>`;
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const fixtures: Record<string, Uint8Array> = {
    [`${rawRoot}/registry.json`]: bytes(registry),
    [`${rawRoot}/blocks/reviewed-carousel/registry-item.json`]: bytes(item),
    [`${rawRoot}/blocks/reviewed-carousel/reviewed-carousel.html`]: bytes(html),
    [assetUrl]: png,
    ...overrides,
  };
  return async (url) => {
    const value = fixtures[url];
    if (!value) throw new Error(`Unexpected fixture URL: ${url}`);
    return value;
  };
}

function selection() {
  return catalogSelectionSchema.parse({
    schemaVersion: 1,
    source: `https://github.com/heygen-com/hyperframes/tree/${revision}/registry`,
    releaseTag: "v0.8.40",
    revision,
    packages: {
      producer: { name: "@hyperframes/producer", version: "0.8.40" },
      cli: { name: "hyperframes", version: "0.8.40" },
    },
    license: "Apache-2.0",
    items: [
      {
        name: "reviewed-carousel",
        type: "block",
        templateId: "hf-reviewed-carousel-v1",
        presets: ["product-launch"],
        layouts: ["portrait", "landscape", "square"],
      },
    ],
  });
}

describe("deterministic HyperFrames catalog synchronization", () => {
  it("vendors reviewed files and records every unsupported registry item", async () => {
    const bundle = await buildCatalogSyncBundle(selection(), fixtureFetch());

    expect(bundle.catalog).toMatchObject({
      schemaVersion: 2,
      releaseTag: "v0.8.40",
      sourceRevision: revision,
    });
    expect(bundle.capabilities.registryCounts).toEqual({
      blocks: 1,
      components: 1,
      examples: 1,
    });
    expect(bundle.capabilities.items[0]).toMatchObject({
      capabilityId: "hf.catalog.block.reviewed-carousel",
      requiredLocalMedia: ["image"],
      offlineReady: true,
      runtimeRewrites: ["google-fonts", "gsap"],
    });
    expect(bundle.unsupported.items).toEqual([
      expect.objectContaining({
        name: "unreviewed-component",
        reason: expect.stringContaining("outside the reviewed"),
      }),
      expect.objectContaining({
        name: "starter",
        reason: expect.stringContaining("project scaffolds"),
      }),
    ]);
    expect([...bundle.files.keys()]).toEqual(
      expect.arrayContaining([
        "blocks/reviewed-carousel/reviewed-carousel.html",
        "blocks/reviewed-carousel/assets/example.png",
        "catalog.json",
        "capabilities.json",
        "unsupported.json",
      ]),
    );
  });

  it("produces byte-identical output for identical pinned inputs", async () => {
    const first = await buildCatalogSyncBundle(selection(), fixtureFetch());
    const second = await buildCatalogSyncBundle(selection(), fixtureFetch());

    expect([...second.files]).toEqual([...first.files]);
  });

  it("audits native adapters without embedding upstream demo media", async () => {
    const nativeSelection = catalogSelectionSchema.parse({
      ...selection(),
      items: [{ ...selection().items[0], integration: "native-adapter" }],
    });
    const bundle = await buildCatalogSyncBundle(
      nativeSelection,
      fixtureFetch(),
    );

    expect(bundle.catalog.items[0].files).toEqual(
      expect.arrayContaining([expect.objectContaining({ embedded: false })]),
    );
    expect(bundle.capabilities.items[0].integration).toBe("native-adapter");
    expect([...bundle.files.keys()]).toEqual([
      "catalog.json",
      "capabilities.json",
      "unsupported.json",
    ]);
  });

  it("rejects undeclared assets and unexpected network dependencies", async () => {
    const itemUrl = `${rawRoot}/blocks/reviewed-carousel/reviewed-carousel.html`;
    const invalid = fixtureFetch({
      [itemUrl]: bytes(
        '<img src="assets/missing.png"><script src="https://example.com/runtime.js"></script>',
      ),
    });

    await expect(buildCatalogSyncBundle(selection(), invalid)).rejects.toThrow(
      /unsupported network URL|undeclared asset/,
    );
  });

  it("requires package targets to match the stable release tag", () => {
    const input = { ...selection(), releaseTag: "v0.8.41" };
    expect(() => catalogSelectionSchema.parse(input)).toThrow(
      /package targets must match/i,
    );
  });
});
