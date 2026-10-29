import { z } from "zod";

const id = z.string().trim().min(1).max(160);
const text = z.string().trim().min(1).max(8000);

/** URL syntax only. Network access must additionally use the hardened fetcher. */
export const researchUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Use an HTTP(S) URL without credentials");

export const researchUsageSchema = z.object({
  providerCalls: z.number().int().min(0).max(1),
  // A reserved grounded prompt is a charge allowance, not a count of queries.
  searchChargeUnits: z.number().int().min(0).max(1),
  searchChargeUnit: z.enum(["grounded_prompt", "web_search_call"]),
  searchQueries: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  accounting: z.enum(["reported", "reserved", "unknown"]),
});
export type ResearchUsage = z.infer<typeof researchUsageSchema>;

export const evidencePackSchema = z
  .object({
    version: z.literal(1),
    id,
    revision: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    query: text,
    summary: z.string().max(50_000),
    provenance: z.object({
      kind: z.enum([
        "native_search",
        "supplied_sources",
        "external_unverified",
      ]),
      providerId: z.string().max(80).nullable(),
      modelId: z.string().max(160).nullable(),
      endpoint: z.string().max(200).nullable(),
    }),
    sources: z
      .array(
        z.object({
          id,
          url: researchUrlSchema.nullable(),
          title: z.string().trim().min(1).max(500),
          retrievedAt: z.iso.datetime(),
          publishedAt: z.iso.datetime().nullable(),
          provenance: z.enum([
            "provider_citation",
            "fetched_page",
            "user_supplied",
            "external_unverified",
          ]),
          excerpts: z
            .array(
              z.object({
                id,
                text,
                // Provider grounding segments are generated text, not verbatim page quotes.
                kind: z.enum(["source_text", "provider_segment"]),
              }),
            )
            .max(100),
        }),
      )
      .max(100),
    claims: z
      .array(
        z.object({
          id,
          text,
          references: z
            .array(z.object({ sourceId: id, excerptId: id }))
            .min(1)
            .max(100),
        }),
      )
      .max(100),
    conflicts: z
      .array(
        z.object({
          id,
          description: text,
          claimIds: z.array(id).min(2).max(100),
        }),
      )
      .max(100),
    gaps: z.array(text).max(100),
    attribution: z.object({
      required: z.boolean(),
      // Retain provider attribution verbatim. Never inject this into the app DOM.
      searchSuggestionHtml: z.string().max(100_000).nullable(),
      searchQueries: z.array(z.string().max(2000)).max(100),
      // Bounded original grounding/URL metadata, retained for audit and display.
      providerMetadata: z.string().max(300_000).nullable(),
    }),
    usage: researchUsageSchema,
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    const unique = (value: string) => {
      if (seen.has(value))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate evidence ID: ${value}`,
        });
      seen.add(value);
    };
    const sources = new Map(pack.sources.map((source) => [source.id, source]));
    pack.sources.forEach((source) => {
      unique(source.id);
      source.excerpts.forEach((excerpt) => unique(excerpt.id));
      if (source.provenance !== "user_supplied" && !source.url)
        ctx.addIssue({
          code: "custom",
          message: "Retrieved sources require a URL",
        });
    });
    pack.claims.forEach((claim) => {
      unique(claim.id);
      claim.references.forEach((ref) => {
        if (
          !sources
            .get(ref.sourceId)
            ?.excerpts.some((excerpt) => excerpt.id === ref.excerptId)
        )
          ctx.addIssue({
            code: "custom",
            message: `Invalid source/excerpt reference in ${claim.id}`,
          });
      });
    });
    const claims = new Set(pack.claims.map((claim) => claim.id));
    pack.conflicts.forEach((conflict) => {
      unique(conflict.id);
      if (
        new Set(conflict.claimIds).size < 2 ||
        conflict.claimIds.some((value) => !claims.has(value))
      )
        ctx.addIssue({
          code: "custom",
          message: "Conflicts require at least two distinct existing claims",
        });
    });
    if (pack.provenance.kind === "native_search" && !pack.attribution.required)
      ctx.addIssue({
        code: "custom",
        message: "Native search requires visible attribution",
      });
  });
export type EvidencePack = z.infer<typeof evidencePackSchema>;

export const researchRequestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(160),
    query: z.string().trim().min(3).max(8000),
    mode: z.enum(["web", "supplied"]),
    providerId: z.enum(["gemini", "openai"]).optional(),
    modelId: z.string().trim().min(1).max(160).optional(),
    urls: z.array(researchUrlSchema).max(5).default([]),
    sources: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(500),
          url: researchUrlSchema.optional(),
          text: z.string().trim().min(20).max(40_000),
        }),
      )
      .max(5)
      .default([]),
    refresh: z.boolean().default(false),
    budget: z
      .object({
        maxProviderCalls: z.number().int().min(0).max(1),
        maxSearchChargeUnits: z.number().int().min(0).max(1),
        deadlineMs: z.number().int().min(1000).max(45_000),
        maxOutputTokens: z.number().int().min(256).max(4096),
      })
      .default({
        maxProviderCalls: 0,
        maxSearchChargeUnits: 0,
        deadlineMs: 30_000,
        maxOutputTokens: 2048,
      }),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.mode === "web" &&
      (!request.providerId || request.sources.length)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Web research requires an explicit provider and no pasted sources",
      });
    if (
      request.mode === "supplied" &&
      !request.sources.length &&
      !request.urls.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Supply text or public article URLs",
      });
    if (request.mode === "supplied" && (request.providerId || request.modelId))
      ctx.addIssue({
        code: "custom",
        message: "Supplied research does not use a cloud provider",
      });
    if (
      request.mode === "web" &&
      (request.budget.maxProviderCalls < 1 ||
        request.budget.maxSearchChargeUnits < 1)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Web research requires separate provider-call and search-tool charge allowances",
      });
  });
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchRequestInput = z.input<typeof researchRequestSchema>;

export const EMPTY_RESEARCH_USAGE: ResearchUsage = {
  providerCalls: 0,
  searchChargeUnits: 0,
  searchChargeUnit: "grounded_prompt",
  searchQueries: 0,
  inputTokens: 0,
  outputTokens: 0,
  accounting: "reported",
};
