import { randomUUID } from "node:crypto";
import { ingestPublicArticle } from "@/production/source-ingestion";
import {
  evidencePackSchema,
  EMPTY_RESEARCH_USAGE,
  type EvidencePack,
} from "@/research/contracts";
import type { ResearchAdapterInput } from "./research-service";

/** Deterministic source capture. Text remains unverified reference data. */
export async function researchSuppliedSources({
  request,
  signal,
}: ResearchAdapterInput): Promise<EvidencePack> {
  const now = new Date().toISOString();
  const sources: EvidencePack["sources"] = [];
  const gaps = [
    "Supplied sources have not been independently verified. No cloud synthesis or conflict check was performed.",
  ];
  const add = (
    title: string,
    text: string,
    url: string | null,
    fetched: boolean,
  ) => {
    const id = `source-${sources.length + 1}`;
    // Preserve every supplied/fetched character in bounded source-text excerpts.
    const excerpts: EvidencePack["sources"][number]["excerpts"] = [];
    for (let start = 0; start < text.length; start += 8000) {
      const chunk = text.slice(start, start + 8000).trim();
      if (chunk)
        excerpts.push({
          id: `${id}-excerpt-${excerpts.length + 1}`,
          text: chunk,
          kind: "source_text",
        });
    }
    sources.push({
      id,
      title,
      url,
      retrievedAt: now,
      publishedAt: null,
      provenance: fetched ? "fetched_page" : "user_supplied",
      excerpts,
    });
  };
  for (const source of request.sources) {
    signal.throwIfAborted();
    add(source.title, source.text, source.url ?? null, false);
  }
  for (const url of request.urls) {
    signal.throwIfAborted();
    try {
      const article = await ingestPublicArticle(url, { signal });
      add(
        article.title || new URL(article.url).hostname,
        article.text,
        article.url,
        true,
      );
    } catch {
      signal.throwIfAborted();
      gaps.push(
        `Supplied URL ${request.urls.indexOf(url) + 1} could not be safely read; no content was retained for it.`,
      );
    }
  }
  if (!sources.length) gaps.push("No readable sources were captured.");
  return evidencePackSchema.parse({
    version: 1,
    id: randomUUID(),
    revision: 1,
    createdAt: now,
    query: request.query,
    summary:
      "Supplied source capture. Review source excerpts; no factual synthesis has been generated.",
    provenance: {
      kind: "supplied_sources",
      providerId: null,
      modelId: null,
      endpoint: null,
    },
    sources,
    claims: [],
    conflicts: [],
    gaps,
    attribution: {
      required: false,
      searchSuggestionHtml: null,
      searchQueries: [],
      providerMetadata: null,
    },
    usage: { ...EMPTY_RESEARCH_USAGE },
  });
}
