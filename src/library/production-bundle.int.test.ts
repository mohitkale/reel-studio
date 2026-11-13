// @vitest-environment node
import { createGunzip } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  createProductionBundleStream,
  productionBatchBundleEntries,
} from "@/library/production-bundle";

function tarEntry(buffer: Buffer, offset: number) {
  const name = buffer
    .subarray(offset, offset + 100)
    .toString()
    .replace(/\0.*$/, "");
  const size = Number.parseInt(
    buffer
      .subarray(offset + 124, offset + 136)
      .toString()
      .replace(/\0.*$/, ""),
    8,
  );
  const contentStart = offset + 512;
  return {
    name,
    size,
    content: buffer.subarray(contentStart, contentStart + size),
    next: contentStart + Math.ceil(size / 512) * 512,
  };
}

describe("production batch bundles", () => {
  it("archives completed outputs with a manifest for failed items", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-bundle-"));
    try {
      const outputPath = path.join(directory, "sample.mp4");
      writeFileSync(outputPath, "verified-video");
      const entries = await productionBatchBundleEntries(
        {
          id: "batch-1",
          items: [
            {
              rowIndex: 0,
              variantIndex: 0,
              label: "Launch clip",
              orientation: "portrait",
              validationError: null,
              job: {
                id: "job-1",
                state: "succeeded",
                error: null,
                outputs: [
                  {
                    id: "output-1",
                    kind: "video",
                    format: "mp4",
                    path: outputPath,
                    checksum: "sha",
                    metadataJson: null,
                    createdAt: new Date("2026-09-13T10:00:00Z"),
                  },
                ],
              },
            },
            {
              rowIndex: 1,
              variantIndex: 0,
              label: "Broken clip",
              orientation: "square",
              validationError: "Missing screenshot",
              job: null,
            },
          ],
        },
        directory,
      );
      const chunks: Buffer[] = [];
      for await (const chunk of createProductionBundleStream(entries).pipe(
        createGunzip(),
      )) {
        chunks.push(chunk as Buffer);
      }
      const archive = Buffer.concat(chunks);
      const manifest = tarEntry(archive, 0);
      const artifact = tarEntry(archive, manifest.next);
      expect(manifest.name).toBe("manifest.json");
      expect(JSON.parse(manifest.content.toString()).items[1]).toMatchObject({
        state: "failed",
        error: "Missing screenshot",
      });
      expect(artifact.name).toBe("01-Launch-clip-portrait-1.mp4");
      expect(artifact.content.toString()).toBe(
        readFileSync(outputPath, "utf8"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
