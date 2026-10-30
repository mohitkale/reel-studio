import { createHash, randomUUID } from "node:crypto";
import { evidencePackSchema, EMPTY_RESEARCH_USAGE } from "@/research/contracts";
import { ResearchError, ResearchRepository } from "./repositories/research";

/** Validate every mapping before replacing caller-controlled trust/accounting labels. */
export function normalizeExternalEvidence(input: unknown) {
  const source = evidencePackSchema.parse(input);
  const pack = evidencePackSchema.parse({
    ...source,
    id: randomUUID(),
    revision: 1,
    createdAt: new Date().toISOString(),
    provenance: {
      kind: "external_unverified",
      providerId: null,
      modelId: null,
      endpoint: null,
    },
    sources: source.sources.map((item) => ({
      ...item,
      provenance: "external_unverified",
    })),
    gaps: [
      ...source.gaps.slice(0, 99),
      "Imported evidence is external and unverified. Provider claims and source dates were supplied by the caller.",
    ],
    attribution: {
      required: false,
      searchSuggestionHtml: null,
      searchQueries: [],
      providerMetadata: null,
    },
    usage: { ...EMPTY_RESEARCH_USAGE },
  });
  if (Buffer.byteLength(JSON.stringify(pack)) > 900_000)
    throw new ResearchError("Evidence exceeds its inspection size limit", 400);
  return pack;
}

export async function importExternalEvidence(
  input: unknown,
  repository = new ResearchRepository(),
) {
  const pack = normalizeExternalEvidence(input);
  // Immutable content-addressed import: reconnecting never creates another revision.
  const { id: _id, createdAt: _created, ...content } = pack;
  void _id;
  void _created;
  const cacheKey = `external:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
  return repository.importExternal(cacheKey, pack);
}
