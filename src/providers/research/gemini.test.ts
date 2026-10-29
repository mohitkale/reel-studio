// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeResearchRequest } from "@/library/research-service";
import { assertPublicArticleUrl } from "@/production/source-ingestion";
import { normalizeGeminiResearch, researchWithGemini } from "./gemini";
import grounded from "./fixtures/gemini-grounded.json";

vi.mock("@/production/source-ingestion", () => ({
  assertPublicArticleUrl: vi.fn(async (url: string) => new URL(url)),
}));
const request = () =>
  normalizeResearchRequest({
    idempotencyKey: "gemini-fixture",
    mode: "web",
    query: "What does the product do?",
    providerId: "gemini",
    budget: {
      maxProviderCalls: 1,
      maxSearchChargeUnits: 1,
      deadlineMs: 30_000,
      maxOutputTokens: 1024,
    },
  });
const input = () => ({
  request: request(),
  signal: new AbortController().signal,
  onProviderCall: vi.fn(async () => {}),
});

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "fixture-key");
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini research normalization", () => {
  it("retains source mappings, original metadata, usage and mandatory attribution", () => {
    const pack = normalizeGeminiResearch(grounded, request());
    expect(pack.claims[0].references).toEqual([
      { sourceId: "source-1", excerptId: "segment-1-source-1" },
    ]);
    expect(pack.sources[0].excerpts[0]).toMatchObject({
      text: grounded.candidates[0].content.parts[0].text,
      kind: "provider_segment",
    });
    expect(pack.attribution).toMatchObject({
      required: true,
      searchSuggestionHtml:
        grounded.candidates[0].groundingMetadata.searchEntryPoint
          .renderedContent,
    });
    expect(
      JSON.parse(pack.attribution.providerMetadata!).groundingMetadata,
    ).toEqual(grounded.candidates[0].groundingMetadata);
    expect(pack.usage).toMatchObject({
      providerCalls: 1,
      searchChargeUnits: 1,
      searchQueries: 1,
      inputTokens: 100,
      outputTokens: 20,
    });
  });
  it("interprets citation offsets as UTF-8 bytes, including multibyte text", () => {
    const value = structuredClone(grounded);
    const text = "A café opens today.";
    value.candidates[0].content.parts[0].text = text;
    Object.assign(
      value.candidates[0].groundingMetadata.groundingSupports[0].segment,
      { text, endIndex: Buffer.byteLength(text) },
    );
    expect(normalizeGeminiResearch(value, request()).claims[0].text).toBe(text);
  });
  it.each([
    {},
    {
      candidates: [
        { content: { parts: [{ text: "A statement with no evidence." }] } },
      ],
    },
  ])(
    "retains empty/ungrounded answers with gaps and no fabricated claims",
    (value) => {
      const pack = normalizeGeminiResearch(value, request());
      expect(pack.claims).toEqual([]);
      expect(pack.sources).toEqual([]);
      expect(pack.gaps.join(" ")).toContain("ungrounded");
      expect(pack.attribution.required).toBe(true);
    },
  );
  it("retains URL retrieval outcomes without turning them into claims", () => {
    const pack = normalizeGeminiResearch(
      {
        candidates: [
          {
            content: { parts: [{ text: "Partial findings" }] },
            finishReason: "MAX_TOKENS",
            urlContextMetadata: {
              urlMetadata: [
                {
                  retrievedUrl: "https://example.com/article",
                  urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS",
                },
                {
                  retrievedUrl: "https://example.com/missing",
                  urlRetrievalStatus: "URL_RETRIEVAL_STATUS_ERROR",
                },
              ],
            },
          },
        ],
      },
      request(),
    );
    expect(pack.sources).toHaveLength(1);
    expect(pack.claims).toEqual([]);
    expect(pack.gaps.join(" ")).toContain("incomplete");
    expect(pack.attribution.providerMetadata).toContain(
      "URL_RETRIEVAL_STATUS_ERROR",
    );
  });
  it("rejects malformed citations instead of attaching the wrong evidence", () => {
    const value = structuredClone(grounded);
    value.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices =
      [9];
    expect(() => normalizeGeminiResearch(value, request())).toThrow(
      "references",
    );
    value.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices =
      [0];
    value.candidates[0].groundingMetadata.groundingSupports[0].segment.text =
      "Invented quote";
    expect(() => normalizeGeminiResearch(value, request())).toThrow(
      "inconsistent",
    );
    value.candidates[0].groundingMetadata.groundingChunks[0].web.uri =
      "javascript:alert(1)";
    expect(() => normalizeGeminiResearch(value, request())).toThrow();
  });
});

describe("Gemini research transport", () => {
  it("uses one dedicated research request with optional URL context, no scene schema", async () => {
    const fetcher = vi.fn(async () => Response.json(grounded));
    vi.stubGlobal("fetch", fetcher);
    const args = input();
    args.request.urls = ["https://example.com/article"];
    expect((await researchWithGemini(args)).claims).toHaveLength(1);
    expect(assertPublicArticleUrl).toHaveBeenCalledWith(args.request.urls[0]);
    expect(args.onProviderCall).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
    const body = JSON.parse(String(init.body));
    expect(body.tools).toEqual([{ google_search: {} }, { url_context: {} }]);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: 1024,
      temperature: 0.2,
    });
    expect(body.systemInstruction.parts[0].text).toContain(
      "untrusted reference data",
    );
    expect(init.redirect).toBe("error");
    expect(url).not.toContain("fixture-key");
  });
  it("rejects missing keys and unverified model/endpoint combinations before paid IO", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const args = input();
    args.request.modelId = "gemini-3.8-flash";
    await expect(researchWithGemini(args)).rejects.toMatchObject({
      status: 400,
    });
    args.request.modelId = "gemini-2.5-flash";
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(researchWithGemini(args)).rejects.toThrow("GEMINI_API_KEY");
    expect(args.onProviderCall).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 429, 503])(
    "redacts HTTP %s errors and never retries a charged POST",
    async (status) => {
      const fetcher = vi.fn(
        async () =>
          new Response("fixture-key private page content", { status }),
      );
      vi.stubGlobal("fetch", fetcher);
      const error = await researchWithGemini(input()).catch(
        (error: unknown) => error,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toMatch(/fixture-key|private page/);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it("bounds declared and streamed response sizes and redacts malformed JSON", async () => {
    for (const response of [
      new Response("{}", { headers: { "content-length": "1000001" } }),
      new Response("x".repeat(1_000_001)),
      new Response("private invalid provider body"),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );
      await expect(researchWithGemini(input())).rejects.toThrow(
        /size limit|invalid response/,
      );
    }
  });
  it("aborts before a call and during a stalled body without replay", async () => {
    const abort = new AbortController();
    abort.abort();
    const args = { ...input(), signal: abort.signal };
    await expect(researchWithGemini(args)).rejects.toThrow();
    expect(args.onProviderCall).not.toHaveBeenCalled();
    const controller = new AbortController();
    let cancel!: () => void;
    const canceled = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ReadableStream({ cancel }))),
    );
    const pending = researchWithGemini({
      ...input(),
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 499 });
    await canceled;
  });
});

it.skipIf(process.env.REEL_LIVE_RESEARCH !== "1")(
  "opt-in paid Gemini research smoke",
  async () => {
    // beforeEach supplies a fixture key in this file; use a separate explicit live key.
    vi.stubEnv("GEMINI_API_KEY", process.env.REEL_LIVE_GEMINI_KEY ?? "");
    const pack = await researchWithGemini({
      ...input(),
      request: {
        ...request(),
        query:
          "What is the official Node.js LTS release policy? Cite nodejs.org.",
      },
    });
    expect(pack.attribution.required).toBe(true);
    expect(pack.usage.providerCalls).toBe(1);
  },
);
