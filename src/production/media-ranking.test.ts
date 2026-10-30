import { expect, it } from "vitest";
import { stockMediaCandidateSchema } from "@/providers/stock/schemas";
import { rankStockCandidates, selectionRanking } from "./media-ranking";
const candidate = (id: string, extra: Record<string, unknown> = {}) =>
  stockMediaCandidateSchema.parse({
    providerId: "pexels",
    providerAssetId: id,
    kind: "image",
    previewUrl: `https://images.example.test/${id}.jpg`,
    sourcePageUrl: `https://example.test/photos/${id}`,
    creator: "Fixture",
    width: 1080,
    height: 1920,
    orientation: "portrait",
    renderRenditions: [
      {
        id: "original",
        url: `https://images.example.test/${id}.jpg`,
        width: 1080,
        height: 1920,
      },
    ],
    attribution: { text: "Fixture", required: true },
    acquisitionPolicy: "download",
    ...extra,
  });
it("ranks actual subject metadata before arbitrary IDs and remains stable across candidate order", () => {
  const relevant = candidate("zebra-id", {
      description: "Ocean turtle conservation underwater",
    }),
    unrelated = candidate("aaa-id", {
      description: "Business meeting in a busy office",
    });
  const context = {
    query: "ocean turtle conservation",
    orientation: "portrait" as const,
  };
  expect(
    rankStockCandidates([unrelated, relevant], context)[0].candidate,
  ).toEqual(relevant);
  expect(
    rankStockCandidates([relevant, unrelated], context)[0].candidate,
  ).toEqual(relevant);
  const ranking = selectionRanking(
    rankStockCandidates([unrelated, relevant], context),
    0,
    context.query,
  );
  expect(ranking.selected.reasons.join(" ")).toContain("Text space unknown");
  expect(ranking.alternatives).toHaveLength(1);
});
it("scores crop, resolution and exact duplicates while comparing known film style", () => {
  const good = candidate("good", {
      tags: ["ocean"],
      styleTags: ["calm", "blue"],
    }),
    crop = candidate("crop", {
      width: 1920,
      height: 1080,
      orientation: "landscape",
      tags: ["ocean"],
      styleTags: ["neon"],
      renderRenditions: [
        {
          id: "small",
          url: "https://images.example.test/small.jpg",
          width: 640,
          height: 360,
        },
      ],
    }),
    duplicate = candidate("used", {
      tags: ["ocean"],
      styleTags: ["calm", "blue"],
    });
  const ranked = rankStockCandidates([crop, duplicate, good], {
    query: "ocean",
    orientation: "portrait",
    usedKeys: ["pexels:used"],
    filmStyleTags: ["calm", "blue"],
  });
  expect(ranked[0].candidate.providerAssetId).toBe("good");
  expect(
    ranked.find((r) => r.candidate.providerAssetId === "crop")!.summary
      .components,
  ).toMatchObject({
    crop: expect.any(Number),
    resolution: expect.any(Number),
    consistency: 0,
  });
  expect(
    ranked.find((r) => r.candidate.providerAssetId === "used")!.summary
      .components.duplicate,
  ).toBe(true);
});
it("keeps optional pixel assessments separate and bounded by the caller's candidate set", () => {
  const ranked = rankStockCandidates([candidate("one"), candidate("two")], {
    query: "ocean",
    orientation: "portrait",
    vision: [
      {
        candidateId: "pexels:two",
        relevance: 1,
        textSpace: 1,
        styleTags: ["calm"],
        reason: "Clear quiet area on the left",
      },
    ],
  });
  expect(ranked[0].candidate.providerAssetId).toBe("two");
  expect(selectionRanking(ranked, 0, "ocean", true).method).toBe(
    "metadata+vision",
  );
});
