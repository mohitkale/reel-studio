import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

import {
  stockMediaExternalUrlSchema,
  stockMediaKindSchema,
  stockMediaRenditionSchema,
  type StockMediaKind,
  type StockMediaRendition,
} from "@/providers/stock/schemas";
import { StockError } from "@/providers/stock/types";

export const downloadedStockMediaMetadataSchema = z
  .object({
    kind: stockMediaKindSchema,
    mimeType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ]),
    extension: z.enum(["jpg", "png", "webp", "mp4", "webm"]),
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
    durationSec: z.number().finite().positive().max(86_400).optional(),
    bytes: z.number().int().positive(),
  })
  .strict();
export type DownloadedStockMediaMetadata = z.infer<
  typeof downloadedStockMediaMetadataSchema
>;

export interface DownloadedStockMedia {
  data: Buffer;
  finalUrl: string;
  metadata: DownloadedStockMediaMetadata;
}

export interface VideoProbeResult {
  width: number;
  height: number;
  durationSec: number;
}

export interface DownloadStockMediaOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  probeVideo?: (
    data: Buffer,
    extension: "mp4" | "webm",
    signal?: AbortSignal,
  ) => Promise<VideoProbeResult>;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_BYTES: Record<StockMediaKind, number> = {
  image: 25 * 1024 * 1024,
  video: 250 * 1024 * 1024,
};

function normalizedContentType(value: string | null): string {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function sniffMedia(data: Buffer): {
  kind: StockMediaKind;
  mimeType: DownloadedStockMediaMetadata["mimeType"];
  extension: DownloadedStockMediaMetadata["extension"];
} {
  if (
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { kind: "image", mimeType: "image/png", extension: "png" };
  }
  if (
    data.length >= 4 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return { kind: "image", mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    data.length >= 30 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { kind: "image", mimeType: "image/webp", extension: "webp" };
  }
  if (data.length >= 12 && data.toString("ascii", 4, 8) === "ftyp") {
    return { kind: "video", mimeType: "video/mp4", extension: "mp4" };
  }
  if (
    data.length >= 4 &&
    data[0] === 0x1a &&
    data[1] === 0x45 &&
    data[2] === 0xdf &&
    data[3] === 0xa3
  ) {
    return { kind: "video", mimeType: "video/webm", extension: "webm" };
  }
  throw new StockError(
    "Downloaded stock media has an unsupported file signature",
    502,
  );
}

function pngDimensions(data: Buffer): { width: number; height: number } {
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function jpegDimensions(data: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > data.length) break;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  throw new StockError("Downloaded JPEG has no readable dimensions", 502);
}

function webpDimensions(data: Buffer): { width: number; height: number } {
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X" && data.length >= 30) {
    return {
      width: 1 + data.readUIntLE(24, 3),
      height: 1 + data.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 " && data.length >= 30) {
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
    const bits = data.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  throw new StockError("Downloaded WebP has no readable dimensions", 502);
}

function imageDimensions(
  data: Buffer,
  mimeType: DownloadedStockMediaMetadata["mimeType"],
): { width: number; height: number } {
  if (mimeType === "image/png") return pngDimensions(data);
  if (mimeType === "image/jpeg") return jpegDimensions(data);
  if (mimeType === "image/webp") return webpDimensions(data);
  throw new StockError("Unsupported stock image format", 502);
}

export async function probeStockVideo(
  data: Buffer,
  extension: "mp4" | "webm",
  signal?: AbortSignal,
): Promise<VideoProbeResult> {
  const directory = await mkdtemp(path.join(tmpdir(), "reel-stock-probe-"));
  const filename = path.join(directory, `input.${extension}`);
  try {
    await writeFile(filename, data, { flag: "wx" });
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "stream=width,height",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          filename,
        ],
        { encoding: "utf8", signal, maxBuffer: 1024 * 1024 },
        (error, output) => {
          if (error) reject(error);
          else resolve(output);
        },
      );
    });
    const parsed = z
      .object({
        streams: z
          .array(
            z.object({
              width: z.number().int().positive(),
              height: z.number().int().positive(),
            }),
          )
          .min(1),
        format: z.object({ duration: z.coerce.number().positive() }),
      })
      .passthrough()
      .parse(JSON.parse(stdout));
    return {
      width: parsed.streams[0]!.width,
      height: parsed.streams[0]!.height,
      durationSec: parsed.format.duration,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
      throw new StockError(
        `Stock media exceeds the ${maxBytes}-byte limit`,
        413,
      );
    }
  }
  if (!response.body)
    throw new StockError("Stock media response had no body", 502);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new StockError(
          `Stock media exceeds the ${maxBytes}-byte limit`,
          413,
        );
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0)
    throw new StockError("Downloaded stock media was empty", 502);
  return Buffer.concat(chunks, total);
}

export async function downloadStockMedia(
  renditionInput: StockMediaRendition,
  kindInput: StockMediaKind,
  options: DownloadStockMediaOptions = {},
): Promise<DownloadedStockMedia> {
  const rendition = stockMediaRenditionSchema.parse(renditionInput);
  const kind = stockMediaKindSchema.parse(kindInput);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES[kind];
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Stock download byte limit must be a positive integer");
  }
  if (
    !Number.isInteger(maxRedirects) ||
    maxRedirects < 0 ||
    maxRedirects > 10
  ) {
    throw new Error("Stock download redirect limit must be between 0 and 10");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000) {
    throw new Error("Stock download timeout must be between 1ms and 5 minutes");
  }

  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options.signal) signals.push(options.signal);
  const signal = AbortSignal.any(signals);
  const fetchImpl = options.fetchImpl ?? fetch;
  let currentUrl = stockMediaExternalUrlSchema.parse(rendition.url);
  let response: Response | null = null;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    response = await fetchImpl(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: { Accept: `${kind}/*` },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new StockError("Stock redirect omitted its location", 502);
      if (redirects === maxRedirects) {
        throw new StockError("Stock download exceeded its redirect limit", 502);
      }
      currentUrl = stockMediaExternalUrlSchema.parse(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }
    break;
  }
  if (!response || !response.ok) {
    throw new StockError(
      `Stock download failed (HTTP ${response?.status ?? "unknown"})`,
      response?.status ?? 502,
    );
  }

  const headerMime = normalizedContentType(
    response.headers.get("content-type"),
  );
  const data = await readBoundedBody(response, maxBytes);
  const detected = sniffMedia(data);
  if (detected.kind !== kind) {
    throw new StockError(
      `Expected ${kind} stock media but received ${detected.kind}`,
      502,
    );
  }
  if (headerMime !== detected.mimeType) {
    throw new StockError(
      `Stock response MIME ${headerMime || "missing"} does not match ${detected.mimeType}`,
      502,
    );
  }
  const declaredMime = normalizedContentType(rendition.mimeType ?? null);
  if (declaredMime && declaredMime !== detected.mimeType) {
    throw new StockError(
      `Stock rendition MIME ${declaredMime} does not match ${detected.mimeType}`,
      502,
    );
  }

  const inspected =
    kind === "image"
      ? imageDimensions(data, detected.mimeType)
      : await (options.probeVideo ?? probeStockVideo)(
          data,
          detected.extension as "mp4" | "webm",
          signal,
        );
  const metadata = downloadedStockMediaMetadataSchema.parse({
    kind,
    mimeType: detected.mimeType,
    extension: detected.extension,
    width: inspected.width,
    height: inspected.height,
    durationSec: "durationSec" in inspected ? inspected.durationSec : undefined,
    bytes: data.length,
  });
  return { data, finalUrl: currentUrl, metadata };
}
