import { describe, expect, it } from "vitest";

import {
  resolvedStockAssetSchema,
  stockMediaCandidateSchema,
  type StockMediaCandidate,
} from "./schemas";

function candidate(
  overrides: Partial<StockMediaCandidate> = {},
): StockMediaCandidate {
  return {
    providerId: "fixture-provider",
    providerAssetId: "asset-1",
    kind: "image",
    previewUrl: "https://cdn.example.test/preview.jpg",
    sourcePageUrl: "https://example.test/assets/asset-1",
    creator: "Fixture Creator",
    creatorUrl: "https://example.test/creators/fixture",
    width: 1200,
    height: 1600,
    orientation: "portrait",
    mimeType: "image/jpeg",
    renderRenditions: [
      {
        id: "large",
        url: "https://cdn.example.test/large.jpg?ixid=preserved",
        width: 1200,
        height: 1600,
        mimeType: "image/jpeg",
      },
    ],
    attribution: { text: "Fixture Creator on Fixture", required: true },
    acquisitionPolicy: "hotlink",
    ...overrides,
  };
}

describe("unified stock-media schemas", () => {
  it("validates provider-neutral image and video candidates", () => {
    expect(stockMediaCandidateSchema.parse(candidate()).kind).toBe("image");
    expect(
      stockMediaCandidateSchema.parse(
        candidate({
          providerAssetId: "video-1",
          kind: "video",
          previewUrl: "https://cdn.example.test/video-preview.mp4",
          width: 1920,
          height: 1080,
          durationSec: 12.5,
          orientation: "landscape",
          mimeType: "video/mp4",
          renderRenditions: [
            {
              id: "hd",
              url: "https://cdn.example.test/video.mp4",
              width: 1920,
              height: 1080,
              durationSec: 12.5,
              mimeType: "video/mp4",
            },
          ],
          acquisitionPolicy: "download",
        }),
      ).kind,
    ).toBe("video");
  });

  it("rejects invalid orientation, insecure URLs, MIME mismatches, and duplicates", () => {
    expect(() =>
      stockMediaCandidateSchema.parse(
        candidate({
          previewUrl: "http://cdn.example.test/preview.jpg",
          orientation: "landscape",
          renderRenditions: [
            {
              id: "duplicate",
              url: "https://cdn.example.test/a.jpg",
              width: 1200,
              height: 1600,
              mimeType: "video/mp4",
            },
            {
              id: "duplicate",
              url: "https://cdn.example.test/b.jpg",
              width: 1200,
              height: 1600,
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("validates immutable hotlink and downloaded selection snapshots", () => {
    const capturedAt = "2026-09-14T14:30:00.000Z";
    const image = candidate();
    const hotlink = resolvedStockAssetSchema.parse({
      schemaVersion: 1,
      resolvedAt: capturedAt,
      compliantRemoteUrl: image.renderRenditions[0]!.url,
      providerSnapshot: image,
      sourceRevision: {
        capturedAt,
        termsUrl: "https://example.test/terms",
      },
      selectedRendition: image.renderRenditions[0],
      usageEvent: { state: "pending" },
    });
    expect(hotlink.compliantRemoteUrl).toContain("ixid=preserved");

    const video = candidate({
      providerAssetId: "video-1",
      kind: "video",
      previewUrl: "https://cdn.example.test/video-preview.mp4",
      width: 1920,
      height: 1080,
      durationSec: 12,
      orientation: "landscape",
      mimeType: "video/mp4",
      renderRenditions: [
        {
          id: "hd",
          url: "https://cdn.example.test/video.mp4",
          width: 1920,
          height: 1080,
          durationSec: 12,
          mimeType: "video/mp4",
        },
      ],
      acquisitionPolicy: "download",
    });
    expect(
      resolvedStockAssetSchema.parse({
        schemaVersion: 1,
        resolvedAt: capturedAt,
        localAssetId: "asset-local-1",
        providerSnapshot: video,
        sourceRevision: {
          capturedAt,
          termsUrl: "https://example.test/terms",
        },
        contentHash: "a".repeat(64),
        selectedRendition: video.renderRenditions[0],
        usageEvent: { state: "not-required" },
      }).localAssetId,
    ).toBe("asset-local-1");
  });

  it("rejects snapshots that violate provider acquisition policy", () => {
    const image = candidate();
    expect(() =>
      resolvedStockAssetSchema.parse({
        schemaVersion: 1,
        resolvedAt: "2026-09-14T14:30:00.000Z",
        localAssetId: "asset-local-1",
        providerSnapshot: image,
        sourceRevision: {
          capturedAt: "2026-09-14T14:30:00.000Z",
          termsUrl: "https://example.test/terms",
        },
        contentHash: "a".repeat(64),
        selectedRendition: image.renderRenditions[0],
        usageEvent: { state: "pending" },
      }),
    ).toThrow();
  });
});
