import { z } from "zod";

import { StockError, type StockMediaProvider } from "./types";

export const COVERR_API_INTRODUCTION_URL = "https://api.coverr.co/docs";
export const COVERR_API_START_URL = "https://api.coverr.co/docs/start/";
export const COVERR_DEVELOPER_URL = "https://coverr.co/developers";
export const COVERR_LICENSE_URL = "https://coverr.co/license";

const coverrLicenseGateSchema = z
  .object({
    status: z.literal("blocked"),
    reviewedAt: z.string().date(),
    sources: z.array(z.string().url()).length(4),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const COVERR_LICENSE_GATE = coverrLicenseGateSchema.parse({
  status: "blocked",
  reviewedAt: "2026-09-15",
  sources: [
    COVERR_API_INTRODUCTION_URL,
    COVERR_API_START_URL,
    COVERR_DEVELOPER_URL,
    COVERR_LICENSE_URL,
  ],
  reason:
    "Coverr's API introduction says free API access cannot be used commercially, while its developer and general license pages say API content permits commercial use. These statements conflict, so written API-specific clarification is still required.",
});

const DISABLED_MESSAGE =
  "Coverr is disabled because its current official API and license pages conflict about commercial use. Obtain API-specific clarification before enabling it.";

/**
 * Discoverable Coverr placeholder guarded by the unresolved license decision.
 * It intentionally reads no key and makes no request while the gate is closed.
 */
export function createCoverrProvider(): StockMediaProvider {
  return {
    id: "coverr",
    label: "Coverr (disabled)",
    capabilities: {
      kinds: ["video"],
      acquisitionPolicies: ["download"],
      maxPageSize: 20,
      supportsPagination: true,
      requiresApiKey: true,
      usageReporting: false,
      defaultCacheTtlSec: 0,
    },
    async health() {
      return {
        status: "disabled",
        message: DISABLED_MESSAGE,
        checkedAt: new Date().toISOString(),
      };
    },
    async search() {
      throw new StockError(DISABLED_MESSAGE, 451, "coverr");
    },
  };
}
