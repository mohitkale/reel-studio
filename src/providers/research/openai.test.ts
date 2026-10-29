// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeResearchRequest } from "@/library/research-service";
import { normalizeOpenAIResearch, researchWithOpenAI } from "./openai";
import grounded from "./fixtures/openai-grounded.json";

const request = () =>
  normalizeResearchRequest({
    idempotencyKey: "openai-fixture",
    mode: "web",
    providerId: "openai",
    query: "What does the product do?",
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
  vi.stubEnv("OPENAI_API_KEY", "fixture-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OpenAI research normalization", () => {
  it("retains consulted sources, citation mappings, original annotations and usage", () => {
    const pack = normalizeOpenAIResearch(grounded, request());
    expect(pack.provenance).toMatchObject({
      providerId: "openai",
      modelId: "gpt-4.1-mini",
      endpoint: "v1/responses",
    });
    expect(pack.sources).toHaveLength(2);
    expect(pack.sources[0].excerpts[0]).toMatchObject({
      text: "The editor works locally.",
      kind: "provider_segment",
    });
    expect(pack.claims[0].references).toEqual([
      {
        sourceId: pack.sources[0].id,
        excerptId: pack.sources[0].excerpts[0].id,
      },
    ]);
    expect(pack.attribution.required).toBe(true);
    expect(JSON.parse(pack.attribution.providerMetadata!)).toEqual(grounded);
    expect(pack.usage).toMatchObject({
      providerCalls: 1,
      searchChargeUnits: 1,
      searchChargeUnit: "web_search_call",
      inputTokens: 100,
      outputTokens: 25,
    });
  });
  it("keeps citation provenance when the complete consulted-source list is absent", () => {
    const pack = normalizeOpenAIResearch(
      { ...grounded, output: grounded.output.slice(1) },
      request(),
    );
    expect(pack.sources).toHaveLength(1);
    expect(pack.claims).toHaveLength(1);
    expect(pack.gaps.join(" ")).toContain("complete consulted-source list");
  });
  it("reports missing citations and partial results without inventing claims", () => {
    const pack = normalizeOpenAIResearch(
      { status: "incomplete", output: [] },
      request(),
    );
    expect(pack.claims).toEqual([]);
    expect(pack.usage).toMatchObject({
      providerCalls: 1,
      searchChargeUnits: 0,
      accounting: "reserved",
    });
    expect(pack.gaps.join(" ")).toMatch(/ungrounded.*incomplete/);
  });
  it("rejects malformed offsets, unsafe URLs and excess tool calls", () => {
    const badOffset = structuredClone(grounded);
    badOffset.output[1].content![0].annotations[0].end_index = 1000;
    expect(() => normalizeOpenAIResearch(badOffset, request())).toThrow(
      "offsets",
    );
    expect(() =>
      normalizeOpenAIResearch(
        { ...grounded, output: [grounded.output[0], ...grounded.output] },
        request(),
      ),
    ).toThrow("allowance");
    expect(() =>
      normalizeOpenAIResearch(
        {
          ...grounded,
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "Fact",
                  annotations: [
                    {
                      type: "url_citation",
                      start_index: 0,
                      end_index: 4,
                      url: "javascript:alert(1)",
                      title: "Unsafe",
                    },
                  ],
                },
              ],
            },
          ],
        },
        request(),
      ),
    ).toThrow();
  });
});

describe("OpenAI research transport", () => {
  it("uses bounded Responses web_search without changing the generation transport", async () => {
    const fetcher = vi.fn<
      (url: string, init: RequestInit) => Promise<Response>
    >(async () => Response.json(grounded));
    vi.stubGlobal("fetch", fetcher);
    const args = input();
    await researchWithOpenAI(args);
    expect(args.onProviderCall).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/responses",
    );
    const body = JSON.parse(String(fetcher.mock.calls[0][1].body));
    expect(body).toMatchObject({
      model: "gpt-4.1-mini",
      store: false,
      background: false,
      max_tool_calls: 1,
      max_output_tokens: 1024,
      include: ["web_search_call.action.sources"],
      tools: [{ type: "web_search" }],
    });
    expect(body.text).toBeUndefined();
  });
  it("rejects unsupported models, missing keys and unavailable URL context before paid IO", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const args = input();
    args.request.modelId = "gpt-4o-mini";
    await expect(researchWithOpenAI(args)).rejects.toMatchObject({
      status: 400,
    });
    args.request.modelId = "gpt-4.1-mini";
    args.request.urls = ["https://example.com/article"];
    await expect(researchWithOpenAI(args)).rejects.toThrow("URL context");
    args.request.urls = [];
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(researchWithOpenAI(args)).rejects.toThrow("OPENAI_API_KEY");
    expect(args.onProviderCall).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 429, 503])(
    "redacts HTTP %s errors and never retries",
    async (status) => {
      const fetcher = vi.fn(
        async () => new Response("fixture-key private response", { status }),
      );
      vi.stubGlobal("fetch", fetcher);
      const error = await researchWithOpenAI(input()).catch(
        (error: Error) => error,
      );
      expect((error as Error).message).not.toMatch(
        /fixture-key|private response/,
      );
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it("bounds response bytes and rejects malformed payloads", async () => {
    for (const response of [
      new Response("x".repeat(1_000_001)),
      new Response("invalid JSON"),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );
      await expect(researchWithOpenAI(input())).rejects.toThrow(
        /size limit|invalid response/,
      );
    }
  });
  it("cancels a stalled body and releases its reader", async () => {
    const controller = new AbortController();
    let cancel!: () => void;
    const canceled = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ReadableStream({ cancel }))),
    );
    const pending = researchWithOpenAI({
      ...input(),
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 499 });
    await canceled;
  });
});
