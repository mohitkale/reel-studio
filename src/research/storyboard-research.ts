/**
 * Web research for the storyboard writer. When the chosen provider can search
 * the web (Gemini or OpenAI), one grounded research call runs before the writer
 * and its facts, with their real URLs, go into the brief. Local models and
 * no-key mode skip it and say so. Sources are never invented: only URLs the
 * provider returned as grounding are ever allowed into `storyboard.sources`.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvidencePack, ResearchRequest } from "@/research/contracts";
import { normalizeResearchRequest } from "@/library/research-service";
import { researchWithGemini } from "@/providers/research/gemini";
import { researchWithOpenAI } from "@/providers/research/openai";
import type { Storyboard } from "@/storyboard";

export type ResearchSetting = "auto" | "off";

export interface ResearchNote {
  title: string;
  url: string;
  accessed: string;
  notes: string;
}
export interface ResearchSource {
  title: string;
  url: string;
  accessed: string;
}

export interface ResearchOutcome {
  status: "grounded" | "skipped" | "failed";
  /** A visible note for the result page, for example "Written without web research". */
  note: string | null;
  notes: ResearchNote[];
  sources: ResearchSource[];
  cached: boolean;
  /** Paid calls made for this outcome (0 when cached or skipped). */
  providerCalls: number;
}

export interface ResearchCache {
  get(key: string): Promise<CachedResearch | null>;
  set(key: string, value: CachedResearch): Promise<void>;
}
interface CachedResearch {
  at: number;
  notes: ResearchNote[];
  sources: ResearchSource[];
}

export const RESEARCH_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_NOTES = 6;
const MAX_NOTE_CHARS = 1200;

/** File cache beside the app's other local data, written atomically. */
export function fileResearchCache(
  file = path.join(process.cwd(), ".data", "storyboard-research-cache.json"),
): ResearchCache {
  async function read(): Promise<Record<string, CachedResearch>> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Record<
        string,
        CachedResearch
      >;
    } catch {
      return {};
    }
  }
  return {
    async get(key) {
      return (await read())[key] ?? null;
    },
    async set(key, value) {
      const all = await read();
      const cutoff = Date.now() - RESEARCH_CACHE_MS;
      for (const [k, v] of Object.entries(all))
        if (v.at < cutoff) delete all[k];
      all[key] = value;
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(all), { mode: 0o600 });
      await rename(temp, file);
    },
  };
}

export function researchCacheKey(providerId: string, topic: string): string {
  return createHash("sha256")
    .update(`${providerId}\n${topic.trim().toLowerCase().replace(/\s+/g, " ")}`)
    .digest("hex");
}

/** Notes and sources from the pack's grounded sources only; never from the summary. */
export function notesFromEvidence(pack: EvidencePack): {
  notes: ResearchNote[];
  sources: ResearchSource[];
} {
  const notes: ResearchNote[] = [];
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const source of pack.sources) {
    if (!source.url || seen.has(source.url) || source.excerpts.length === 0)
      continue;
    seen.add(source.url);
    const accessed = source.retrievedAt.slice(0, 10);
    const text = source.excerpts
      .map((e) => e.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    notes.push({
      title: source.title.slice(0, 120),
      url: source.url,
      accessed,
      notes: text.slice(0, MAX_NOTE_CHARS),
    });
    sources.push({
      title: source.title.slice(0, 120),
      url: source.url,
      accessed,
    });
    if (notes.length >= MAX_NOTES) break;
  }
  return { notes, sources };
}

export type ResearchRunner = (input: {
  request: ResearchRequest;
  signal: AbortSignal;
  onProviderCall: () => Promise<void>;
}) => Promise<EvidencePack>;

const RUNNERS: Record<"gemini" | "openai", ResearchRunner> = {
  gemini: researchWithGemini,
  openai: researchWithOpenAI,
};

export async function researchForStoryboard(args: {
  providerId: string;
  topic: string;
  setting?: ResearchSetting;
  /** The user supplied the source text themselves, so there is nothing to look up. */
  hasSourceText?: boolean;
  cache?: ResearchCache;
  runner?: ResearchRunner;
  signal?: AbortSignal;
}): Promise<ResearchOutcome> {
  const skipped = (note: string): ResearchOutcome => ({
    status: "skipped",
    note,
    notes: [],
    sources: [],
    cached: false,
    providerCalls: 0,
  });
  if (args.setting === "off")
    return skipped("Written without web research (research is off).");
  if (args.hasSourceText)
    return skipped("Written from the supplied text; no web research.");
  if (args.providerId !== "gemini" && args.providerId !== "openai") {
    return skipped(
      "Written without web research (this provider cannot search the web).",
    );
  }

  const cache = args.cache ?? fileResearchCache();
  const key = researchCacheKey(args.providerId, args.topic);
  const hit = await cache.get(key).catch(() => null);
  if (hit && Date.now() - hit.at < RESEARCH_CACHE_MS) {
    return {
      status: "grounded",
      note: null,
      notes: hit.notes,
      sources: hit.sources,
      cached: true,
      providerCalls: 0,
    };
  }

  let providerCalls = 0;
  try {
    const request = normalizeResearchRequest({
      idempotencyKey: `storyboard-${key.slice(0, 24)}`,
      mode: "web",
      query: args.topic.slice(0, 8000),
      providerId: args.providerId,
      budget: {
        maxProviderCalls: 1,
        maxSearchChargeUnits: 1,
        deadlineMs: 30_000,
        maxOutputTokens: 2048,
      },
    });
    const pack = await (args.runner ?? RUNNERS[args.providerId])({
      request,
      signal: args.signal ?? AbortSignal.timeout(45_000),
      onProviderCall: async () => {
        providerCalls += 1;
      },
    });
    const { notes, sources } = notesFromEvidence(pack);
    if (notes.length === 0) {
      return {
        ...skipped(
          "Written without web research (the search returned no usable sources).",
        ),
        providerCalls,
      };
    }
    await cache
      .set(key, { at: Date.now(), notes, sources })
      .catch(() => undefined);
    return {
      status: "grounded",
      note: null,
      notes,
      sources,
      cached: false,
      providerCalls,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return {
      ...skipped(
        `Written without web research (research failed: ${reason.slice(0, 160)}).`,
      ),
      status: "failed",
      providerCalls,
    };
  }
}

/** Only URLs the provider grounded, or the caller supplied, may appear as sources. */
export function constrainSources(
  storyboard: Storyboard,
  allowed: readonly ResearchSource[],
): Storyboard {
  const urls = new Set(allowed.map((s) => s.url));
  const written = (storyboard.sources ?? []).filter((s) => urls.has(s.url));
  const sources = written.length > 0 ? written : allowed.slice(0, 5);
  return {
    ...storyboard,
    ...(sources.length ? { sources } : { sources: undefined }),
  } as Storyboard;
}
