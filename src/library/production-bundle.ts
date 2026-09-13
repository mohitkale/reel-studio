import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

import { ProviderError } from "@/providers/voice/types";

export interface ProductionBundleEntry {
  name: string;
  path?: string;
  content?: Buffer;
  size: number;
  modifiedAt: Date;
}

function octal(value: number, width: number): string {
  return Math.max(0, Math.floor(value))
    .toString(8)
    .padStart(width - 1, "0")
    .slice(-(width - 1))
    .concat("\0");
}

export function createTarHeader(entry: ProductionBundleEntry): Buffer {
  const header = Buffer.alloc(512);
  const name = entry.name.replaceAll("\\", "/").slice(-100);
  header.write(name, 0, 100, "utf8");
  header.write(octal(0o644, 8), 100, 8, "ascii");
  header.write(octal(0, 8), 108, 8, "ascii");
  header.write(octal(0, 8), 116, 8, "ascii");
  header.write(octal(entry.size, 12), 124, 12, "ascii");
  header.write(octal(entry.modifiedAt.getTime() / 1_000, 12), 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(
    checksum.toString(8).padStart(6, "0").slice(-6),
    148,
    6,
    "ascii",
  );
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

async function* tarChunks(entries: readonly ProductionBundleEntry[]) {
  for (const entry of entries) {
    yield createTarHeader(entry);
    if (entry.content) {
      yield entry.content;
    } else if (entry.path) {
      for await (const chunk of createReadStream(entry.path)) {
        yield chunk as Buffer;
      }
    }
    const remainder = entry.size % 512;
    if (remainder) yield Buffer.alloc(512 - remainder);
  }
  yield Buffer.alloc(1_024);
}

export function createProductionBundleStream(
  entries: readonly ProductionBundleEntry[],
) {
  return Readable.from(tarChunks(entries)).pipe(createGzip({ level: 6 }));
}

function safeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function productionBatchBundleEntries(
  batch: {
    id: string;
    items: Array<{
      rowIndex: number;
      variantIndex: number;
      label: string | null;
      orientation: string | null;
      validationError: string | null;
      job: {
        id: string;
        state: string;
        error: string | null;
        outputs: Array<{
          id: string;
          kind: string;
          format: string;
          path: string;
          checksum: string | null;
          metadataJson: string | null;
          createdAt: Date;
        }>;
      } | null;
    }>;
  },
  mediaRootPath = path.resolve(process.cwd(), "media"),
): Promise<ProductionBundleEntry[]> {
  const mediaRoot = await realpath(mediaRootPath);
  const manifestItems: Array<Record<string, unknown>> = [];
  const artifacts: ProductionBundleEntry[] = [];
  for (const item of batch.items) {
    const outputs: string[] = [];
    if (item.job?.state === "succeeded") {
      for (const output of item.job.outputs) {
        const candidate = path.isAbsolute(output.path)
          ? output.path
          : path.join(mediaRoot, output.path);
        const resolved = await realpath(candidate);
        const relative = path.relative(mediaRoot, resolved);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          throw new ProviderError(
            "Batch output is outside the media store",
            400,
          );
        }
        const details = await stat(resolved);
        if (!details.isFile()) continue;
        const suffix = item.orientation ? `-${item.orientation}` : "";
        const label = safeName(item.label ?? item.job.id) || "production";
        const extension = safeName(output.format) || "bin";
        const name = `${String(item.rowIndex + 1).padStart(2, "0")}-${label}${suffix}-${item.variantIndex + 1}.${extension}`;
        artifacts.push({
          name,
          path: resolved,
          size: details.size,
          modifiedAt: output.createdAt,
        });
        outputs.push(name);
      }
    }
    manifestItems.push({
      row: item.rowIndex + 1,
      variant: item.variantIndex + 1,
      label: item.label,
      orientation: item.orientation,
      state: item.validationError ? "failed" : (item.job?.state ?? "queued"),
      error: item.validationError ?? item.job?.error ?? null,
      outputs,
    });
  }
  if (!artifacts.length) {
    throw new ProviderError("This batch has no completed artifacts", 409);
  }
  const manifest = Buffer.from(
    `${JSON.stringify({ batchId: batch.id, items: manifestItems }, null, 2)}\n`,
  );
  return [
    {
      name: "manifest.json",
      content: manifest,
      size: manifest.length,
      modifiedAt: new Date(),
    },
    ...artifacts,
  ];
}
