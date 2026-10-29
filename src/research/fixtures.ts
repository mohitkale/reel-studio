import { EMPTY_RESEARCH_USAGE, type EvidencePack } from "./contracts";

export function evidenceFixture(): EvidencePack {
  return {
    version: 1,
    id: "evidence-1",
    revision: 1,
    createdAt: "2026-10-29T12:00:00.000Z",
    query: "A supplied product brief",
    summary: "A local-first editor.",
    provenance: {
      kind: "supplied_sources",
      providerId: null,
      modelId: null,
      endpoint: null,
    },
    sources: [
      {
        id: "source-1",
        url: null,
        title: "Product brief",
        retrievedAt: "2026-10-29T12:00:00.000Z",
        publishedAt: null,
        provenance: "user_supplied",
        excerpts: [
          {
            id: "excerpt-1",
            text: "A local-first editor.",
            kind: "source_text",
          },
        ],
      },
    ],
    claims: [
      {
        id: "claim-1",
        text: "A local-first editor.",
        references: [{ sourceId: "source-1", excerptId: "excerpt-1" }],
      },
    ],
    conflicts: [],
    gaps: [],
    attribution: {
      required: false,
      searchSuggestionHtml: null,
      searchQueries: [],
      providerMetadata: null,
    },
    usage: { ...EMPTY_RESEARCH_USAGE },
  };
}
