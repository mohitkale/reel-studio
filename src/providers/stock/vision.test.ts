// @vitest-environment node
import { expect, it, vi } from "vitest";
import { scoreStockPreviews } from "./vision";
import { stockMediaCandidateSchema } from "./schemas";
const candidate = stockMediaCandidateSchema.parse({
  providerId: "pexels",
  providerAssetId: "one",
  kind: "image",
  previewUrl: "https://images.example.test/one.jpg",
  sourcePageUrl: "https://example.test/one",
  creator: "Fixture",
  width: 1080,
  height: 1920,
  orientation: "portrait",
  renderRenditions: [
    {
      id: "full",
      url: "https://images.example.test/one.jpg",
      width: 1080,
      height: 1920,
    },
  ],
  attribution: { text: "Fixture", required: true },
  acquisitionPolicy: "download",
});
const input = {
  modelId: "explicit-vision-model",
  query: "ocean",
  orientation: "portrait",
  candidates: [candidate],
  budget: { maxProviderCalls: 1, maxImages: 6, deadlineMs: 1000 },
};
it("sends one bounded Responses image request and validates the returned candidate scope", async () => {
  const scores = [
    {
      candidateId: "pexels:one",
      relevance: 0.9,
      textSpace: 0.8,
      styleTags: ["calm"],
      reason: "Open space",
    },
  ];
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ scores }) }],
        },
      ],
    }),
  );
  expect(
    await scoreStockPreviews(input, new AbortController().signal, {
      apiKey: "fixture-key",
      fetchImpl,
    }),
  ).toEqual(scores);
  expect(fetchImpl).toHaveBeenCalledOnce();
  const payload = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
  expect(payload).toMatchObject({
    model: "explicit-vision-model",
    store: false,
    max_output_tokens: 1600,
  });
  expect(payload.input[0].content).toContainEqual({
    type: "input_image",
    image_url: candidate.previewUrl,
    detail: "low",
  });
});
it("rejects zero/missing budgets before sending and never retries HTTP failures", async () => {
  const fetchImpl = vi.fn(
    async () => new Response("private provider diagnostic", { status: 429 }),
  );
  await expect(
    scoreStockPreviews(
      { ...input, budget: { maxProviderCalls: 0 } },
      new AbortController().signal,
      { apiKey: "fixture-key", fetchImpl },
    ),
  ).rejects.toThrow();
  expect(fetchImpl).not.toHaveBeenCalled();
  await expect(
    scoreStockPreviews(input, new AbortController().signal, {
      apiKey: "fixture-key",
      fetchImpl,
    }),
  ).rejects.toThrow("no retry");
  expect(fetchImpl).toHaveBeenCalledOnce();
});
it("rejects fabricated IDs instead of applying or repairing a mismatched assessment", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                scores: [
                  {
                    candidateId: "invented",
                    relevance: 1,
                    textSpace: 1,
                    styleTags: [],
                    reason: "Unknown",
                  },
                ],
              }),
            },
          ],
        },
      ],
    }),
  );
  await expect(
    scoreStockPreviews(input, new AbortController().signal, {
      apiKey: "fixture-key",
      fetchImpl,
    }),
  ).rejects.toThrow("mismatched candidate scope");
  expect(fetchImpl).toHaveBeenCalledOnce();
});
