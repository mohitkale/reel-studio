// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type {
  SaveStockMediaMaterializationInput,
  StockMediaMaterializationRecord,
} from "@/library/repositories/stock-media-services";
import type { AssetStore } from "@/library/storage";
import { downloadStockMedia } from "./stock-media-download";
import { materializeStockMedia } from "./stock-media-materialization";
import type { StockMediaCandidate } from "@/providers/stock/schemas";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function candidate(
  policy: StockMediaCandidate["acquisitionPolicy"] = "download",
): StockMediaCandidate {
  return {
    providerId: "fixture",
    providerAssetId: "photo-1",
    kind: "image",
    previewUrl: "https://preview.example.test/photo.png",
    sourcePageUrl: "https://example.test/photo-1",
    creator: "Fixture Creator",
    width: 1,
    height: 1,
    orientation: "square",
    mimeType: "image/png",
    renderRenditions: [
      {
        id: "original",
        url: "https://origin.example.test/photo.png",
        width: 1,
        height: 1,
        mimeType: "image/png",
      },
    ],
    attribution: { text: "Fixture Creator", required: true },
    acquisitionPolicy: policy,
  };
}

class MemoryStore implements AssetStore {
  readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.files.set(key, Buffer.from(data));
    return { key };
  }
  async get(key: string) {
    const data = this.files.get(key);
    if (!data) throw new Error("missing");
    return Buffer.from(data);
  }
  url(key: string) {
    return `/media/${key}`;
  }
  async exists(key: string) {
    return this.files.has(key);
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}

function memoryPersistence() {
  const records = new Map<string, StockMediaMaterializationRecord>();
  return {
    records,
    async getMaterialization(key: string) {
      return records.get(key) ?? null;
    },
    async putMaterialization(input: SaveStockMediaMaterializationInput) {
      const record: StockMediaMaterializationRecord = { ...input };
      records.set(input.requestHash, record);
      return record;
    },
  };
}

describe("safe stock-media download", () => {
  it("validates a bounded redirect and inspects image magic and dimensions", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.test/photo.png" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(PNG_1X1, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(PNG_1X1.length),
          },
        }),
      );
    const downloaded = await downloadStockMedia(
      candidate().renderRenditions[0]!,
      "image",
      { fetchImpl },
    );
    expect(downloaded.finalUrl).toBe("https://cdn.example.test/photo.png");
    expect(downloaded.metadata).toMatchObject({
      kind: "image",
      mimeType: "image/png",
      width: 1,
      height: 1,
      bytes: PNG_1X1.length,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects private redirects, MIME mismatch, corrupt magic, and oversized files", async () => {
    await expect(
      downloadStockMedia(candidate().renderRenditions[0]!, "image", {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(null, {
            status: 302,
            headers: { location: "https://127.0.0.1/private.png" },
          }),
        ),
      }),
    ).rejects.toThrow();
    await expect(
      downloadStockMedia(candidate().renderRenditions[0]!, "image", {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(PNG_1X1, {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
        ),
      }),
    ).rejects.toThrow("does not match");
    await expect(
      downloadStockMedia(candidate().renderRenditions[0]!, "image", {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(Buffer.from("not an image"), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
        ),
      }),
    ).rejects.toThrow("unsupported file signature");
    await expect(
      downloadStockMedia(candidate().renderRenditions[0]!, "image", {
        maxBytes: PNG_1X1.length - 1,
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(PNG_1X1, {
            status: 200,
            headers: {
              "content-type": "image/png",
              "content-length": String(PNG_1X1.length),
            },
          }),
        ),
      }),
    ).rejects.toThrow("byte limit");
  });

  it("requires a successful duration and dimension probe for stock video", async () => {
    const mp4Header = Buffer.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    const rendition = {
      id: "hd",
      url: "https://cdn.example.test/video.mp4",
      width: 1920,
      height: 1080,
      durationSec: 8,
      mimeType: "video/mp4",
    } as const;
    const probeVideo = vi.fn(async () => ({
      width: 1920,
      height: 1080,
      durationSec: 8,
    }));
    const downloaded = await downloadStockMedia(rendition, "video", {
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(mp4Header, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        }),
      ),
      probeVideo,
    });
    expect(downloaded.metadata).toMatchObject({
      kind: "video",
      width: 1920,
      height: 1080,
      durationSec: 8,
    });
    expect(probeVideo).toHaveBeenCalledOnce();
  });
});

describe("stock-media materialization", () => {
  it("materializes downloaded bytes once and reuses the immutable hash", async () => {
    const media = candidate();
    const store = new MemoryStore();
    const persistence = memoryPersistence();
    const download = vi.fn(async () => ({
      data: PNG_1X1,
      finalUrl: media.renderRenditions[0]!.url,
      metadata: {
        kind: "image" as const,
        mimeType: "image/png" as const,
        extension: "png" as const,
        width: 1,
        height: 1,
        bytes: PNG_1X1.length,
      },
    }));
    const input = {
      candidate: media,
      rendition: media.renderRenditions[0]!,
      termsUrl: "https://example.test/terms",
    };
    const first = await materializeStockMedia(input, {
      store,
      persistence,
      download,
      now: () => new Date("2026-09-14T14:30:00.000Z"),
    });
    const second = await materializeStockMedia(input, {
      store,
      persistence,
      download,
      now: () => new Date("2026-09-14T14:31:00.000Z"),
    });
    expect(download).toHaveBeenCalledTimes(1);
    expect(first.localAssetId).toBe(second.localAssetId);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(store.files.size).toBe(1);
    expect(persistence.records.size).toBe(1);
  });

  it("retains compliant hotlinks without downloading", async () => {
    const media = candidate("hotlink");
    const download = vi.fn();
    const resolved = await materializeStockMedia(
      {
        candidate: media,
        rendition: media.renderRenditions[0]!,
        termsUrl: "https://example.test/terms",
        usageRequired: true,
      },
      {
        download,
        now: () => new Date("2026-09-14T14:30:00.000Z"),
      },
    );
    expect(download).not.toHaveBeenCalled();
    expect(resolved.compliantRemoteUrl).toBe(media.renderRenditions[0]!.url);
    expect(resolved.usageEvent.state).toBe("pending");
  });
});
