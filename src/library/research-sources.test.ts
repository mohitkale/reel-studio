// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { researchSuppliedSources } from "./research-sources";
import { normalizeResearchRequest } from "./research-service";
import { ingestPublicArticle } from "@/production/source-ingestion";

vi.mock("@/production/source-ingestion", () => ({
  ingestPublicArticle: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
describe("supplied source capture", () => {
  it("preserves long text and fetched URL provenance without generating claims", async () => {
    vi.mocked(ingestPublicArticle).mockResolvedValue({
      url: "https://example.com/final",
      title: "Fetched article",
      text: "This is the entire extracted article.",
    });
    const request = normalizeResearchRequest({
      idempotencyKey: "supplied-sources",
      mode: "supplied",
      query: "Product facts",
      urls: ["https://example.com/start"],
      sources: [{ title: "Brief", text: "A".repeat(20_000) }],
    });
    const onProviderCall = vi.fn();
    const pack = await researchSuppliedSources({
      request,
      signal: new AbortController().signal,
      onProviderCall,
    });
    expect(
      pack.sources[0].excerpts.map((excerpt) => excerpt.text).join(""),
    ).toBe(request.sources[0].text);
    expect(pack.sources[1]).toMatchObject({
      url: "https://example.com/final",
      provenance: "fetched_page",
    });
    expect(pack.claims).toEqual([]);
    expect(pack.usage.providerCalls).toBe(0);
    expect(onProviderCall).not.toHaveBeenCalled();
  });
  it("retains partial results and redacts source fetch failures", async () => {
    vi.mocked(ingestPublicArticle).mockRejectedValue(
      new Error("secret-network-address"),
    );
    const request = normalizeResearchRequest({
      idempotencyKey: "supplied-partial",
      mode: "supplied",
      query: "Product facts",
      urls: ["https://example.com/missing"],
      sources: [
        { title: "Brief", text: "This is a supplied product description." },
      ],
    });
    const pack = await researchSuppliedSources({
      request,
      signal: new AbortController().signal,
      onProviderCall: vi.fn(),
    });
    expect(pack.sources).toHaveLength(1);
    expect(pack.gaps.join(" ")).toContain("could not be safely read");
    expect(JSON.stringify(pack)).not.toContain("secret-network-address");
  });
});
