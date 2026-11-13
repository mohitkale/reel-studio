// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import grounded from "@/providers/research/fixtures/gemini-grounded.json";
import { writeStoryboardWithResearch } from "@/providers/ai/storyboard-writer";
import type { AIProvider } from "@/providers/ai/types";
import {
  constrainSources,
  researchCacheKey,
  researchForStoryboard,
  RESEARCH_CACHE_MS,
  type ResearchCache,
} from "./storyboard-research";

function twoSourceGeminiResponse() {
  const response = structuredClone(grounded) as typeof grounded;
  const text = "The editor works locally. Usage doubled in a year.";
  response.candidates[0]!.content.parts[0]!.text = text;
  const metadata = response.candidates[0]!.groundingMetadata;
  metadata.groundingChunks.push({
    web: { uri: "https://example.org/report", title: "Annual report" },
  });
  metadata.groundingSupports.push({
    segment: { startIndex: 26, endIndex: 50, text: "Usage doubled in a year." },
    groundingChunkIndices: [1],
  } as never);
  return response;
}

const memory = (): ResearchCache & { store: Map<string, unknown> } => {
  const store = new Map<string, never>();
  return {
    store,
    async get(key) {
      return (store.get(key) as never) ?? null;
    },
    async set(key, value) {
      store.set(key, value as never);
    },
  };
};

const provider = (id: "gemini" | "openai" | "ollama", reply: unknown) =>
  ({
    id,
    label: id,
    isConfigured: () => true,
    completeStructured: vi.fn(async () => JSON.stringify(reply)),
  }) as unknown as AIProvider & {
    completeStructured: ReturnType<typeof vi.fn>;
  };

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "fixture-key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("researchForStoryboard", () => {
  it("grounded: runs one Gemini research call and keeps only real, cited URLs", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(twoSourceGeminiResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);
    const cache = memory();
    const outcome = await researchForStoryboard({
      providerId: "gemini",
      topic: "What changed in local video tools this month",
      cache,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({
      status: "grounded",
      cached: false,
      providerCalls: 1,
      note: null,
    });
    expect(outcome.sources.map((s) => s.url)).toEqual([
      "https://example.com/product",
      "https://example.org/report",
    ]);
    expect(outcome.notes[0]!.notes).toContain("The editor works locally.");
    expect(outcome.sources[0]!.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cache.store.size).toBe(1);
  });

  it("caches by topic for 24 hours, case and spacing insensitive", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(twoSourceGeminiResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);
    const cache = memory();
    await researchForStoryboard({
      providerId: "gemini",
      topic: "Local video tools",
      cache,
    });
    const second = await researchForStoryboard({
      providerId: "gemini",
      topic: "  local   VIDEO tools ",
      cache,
    });
    expect(second).toMatchObject({
      cached: true,
      providerCalls: 0,
      status: "grounded",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const key = researchCacheKey("gemini", "Local video tools");
    cache.store.set(key, {
      ...(cache.store.get(key) as object),
      at: Date.now() - RESEARCH_CACHE_MS - 1,
    });
    await researchForStoryboard({
      providerId: "gemini",
      topic: "Local video tools",
      cache,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ungrounded: skips with a visible note for a local model, off, or supplied text", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const local = await researchForStoryboard({
      providerId: "ollama",
      topic: "x topic",
    });
    expect(local).toMatchObject({ status: "skipped", providerCalls: 0 });
    expect(local.note).toContain("without web research");
    expect(
      (
        await researchForStoryboard({
          providerId: "gemini",
          topic: "x topic",
          setting: "off",
        })
      ).note,
    ).toContain("research is off");
    expect(
      (
        await researchForStoryboard({
          providerId: "gemini",
          topic: "x topic",
          hasSourceText: true,
        })
      ).note,
    ).toContain("supplied text");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("provider error: falls back to writing without research and says why", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("quota", { status: 429 })),
    );
    const outcome = await researchForStoryboard({
      providerId: "gemini",
      topic: "Local video tools",
      cache: memory(),
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.note).toContain("research failed");
    expect(outcome.notes).toEqual([]);
  });

  it("a search with no usable sources is not reported as grounded", async () => {
    const empty = structuredClone(grounded) as typeof grounded;
    empty.candidates[0]!.groundingMetadata.groundingChunks = [];
    empty.candidates[0]!.groundingMetadata.groundingSupports = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(empty)),
    );
    const outcome = await researchForStoryboard({
      providerId: "gemini",
      topic: "Local video tools",
      cache: memory(),
    });
    expect(outcome.status).toBe("skipped");
    expect(outcome.note).toContain("no usable sources");
  });
});

const storyboard = (sources?: unknown) => ({
  version: 1,
  title: "T",
  scenes: [
    { type: "hook", headline: "H", narration: "A hook worth hearing today." },
  ],
  ...(sources ? { sources } : {}),
});

describe("writeStoryboardWithResearch", () => {
  it("puts grounded notes in the brief and grounded URLs in storyboard.sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(twoSourceGeminiResponse())),
    );
    const gemini = provider("gemini", storyboard());
    const result = await writeStoryboardWithResearch({
      provider: gemini,
      brief: { topic: "Local video tools" },
      researchCache: memory(),
    });
    const user = JSON.parse(
      (gemini.completeStructured.mock.calls[0]![0] as { user: string }).user,
    );
    expect(user.brief.researchNotes).toHaveLength(2);
    expect(result.storyboard?.sources?.map((s) => s.url)).toEqual([
      "https://example.com/product",
      "https://example.org/report",
    ]);
    expect(result.research).toMatchObject({
      status: "grounded",
      sources: 2,
      providerCalls: 1,
    });
  });

  it("drops a URL the model invented", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(twoSourceGeminiResponse())),
    );
    const gemini = provider(
      "gemini",
      storyboard([
        {
          title: "Made up",
          url: "https://invented.example/page",
          accessed: "2026-11-13",
        },
        {
          title: "Annual report",
          url: "https://example.org/report",
          accessed: "2026-11-13",
        },
      ]),
    );
    const result = await writeStoryboardWithResearch({
      provider: gemini,
      brief: { topic: "Local video tools" },
      researchCache: memory(),
    });
    expect(result.storyboard?.sources?.map((s) => s.url)).toEqual([
      "https://example.org/report",
    ]);
  });

  it("ungrounded local model: no research call, no sources, and the note", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ollama = provider(
      "ollama",
      storyboard([
        {
          title: "Made up",
          url: "https://invented.example",
          accessed: "2026-11-13",
        },
      ]),
    );
    const result = await writeStoryboardWithResearch({
      provider: ollama,
      brief: { topic: "Local video tools" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.storyboard?.sources).toBeUndefined();
    expect(result.research.note).toContain("without web research");
    expect(result.errors).toEqual([]);
  });

  it("keeps sources the caller supplied in the brief", async () => {
    const ollama = provider(
      "ollama",
      storyboard([
        {
          title: "Mine",
          url: "https://mine.example/doc",
          accessed: "2026-11-13",
        },
      ]),
    );
    const result = await writeStoryboardWithResearch({
      provider: ollama,
      brief: {
        topic: "T",
        researchNotes: [
          {
            title: "Mine",
            url: "https://mine.example/doc",
            accessed: "2026-11-13",
            notes: "A fact.",
          },
        ],
      },
    });
    expect(result.storyboard?.sources?.map((s) => s.url)).toEqual([
      "https://mine.example/doc",
    ]);
  });

  it("still writes when research fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    const gemini = provider("gemini", storyboard());
    const result = await writeStoryboardWithResearch({
      provider: gemini,
      brief: { topic: "Local video tools" },
      researchCache: memory(),
    });
    expect(result.errors).toEqual([]);
    expect(result.research.status).toBe("failed");
  });
});

describe("constrainSources", () => {
  it("fills in grounded sources when the model wrote none", () => {
    const sb = constrainSources(storyboard() as never, [
      { title: "A", url: "https://a.example", accessed: "2026-11-13" },
    ]);
    expect(sb.sources).toHaveLength(1);
  });
});
