import { z } from "zod";

import {
  orientationFromDims,
  unsplashOrientation,
  type Orientation,
} from "@/lib/orientation";
import {
  resolvedStockAssetSchema,
  stockMediaCandidateSchema,
  stockMediaExternalUrlSchema,
  stockMediaQuotaStateSchema,
  stockMediaSearchResponseSchema,
  stockMediaUsageEventSchema,
  type NormalizedStockMediaSearchRequest,
  type ResolvedStockAsset,
  type StockMediaCandidate,
  type StockMediaQuotaState,
  type StockMediaSearchResponse,
  type StockMediaUsageEvent,
} from "./schemas";
import {
  StockError,
  type StockImage,
  type StockMediaProvider,
  type StockProvider,
} from "./types";

const UNSPLASH_API_BASE = "https://api.unsplash.com";
export const UNSPLASH_API_DOCUMENTATION_URL =
  "https://unsplash.com/documentation";
export const UNSPLASH_API_GUIDELINES_URL =
  "https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines";
const UNSPLASH_LICENSE_URL = "https://unsplash.com/license";
const DEFAULT_TIMEOUT_MS = 15_000;
const CACHE_TTL_SECONDS = 3_600;

const photoSchema = z
  .object({
    id: z.string().trim().min(1).max(2048),
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
    urls: z
      .object({
        full: stockMediaExternalUrlSchema.optional(),
        regular: stockMediaExternalUrlSchema.optional(),
        small: stockMediaExternalUrlSchema.optional(),
      })
      .refine((urls) => Boolean(urls.regular ?? urls.full), {
        message: "Unsplash result has no renderable hotlink",
      }),
    links: z.object({
      html: stockMediaExternalUrlSchema,
      download_location: stockMediaExternalUrlSchema,
    }),
    user: z.object({
      name: z.string().trim().min(1).max(240),
      links: z.object({ html: stockMediaExternalUrlSchema }),
    }),
  })
  .passthrough();

const searchResponseSchema = z
  .object({
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
    results: z.array(photoSchema).max(30),
  })
  .strict();

const usageResponseSchema = z
  .object({ url: stockMediaExternalUrlSchema.optional() })
  .passthrough();

type UnsplashPhoto = z.infer<typeof photoSchema>;

export interface UnsplashProviderOptions {
  apiKey?: () => string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

function appendReferral(url: string): string {
  const value = new URL(url);
  value.searchParams.set("utm_source", "reel_studio");
  value.searchParams.set("utm_medium", "referral");
  return value.toString();
}

function requireUnsplashImageUrl(url: string): string {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "images.unsplash.com" &&
    parsed.hostname !== "plus.unsplash.com"
  ) {
    throw new StockError(
      "Unsplash returned a non-Unsplash image hotlink",
      502,
      "unsplash",
    );
  }
  return url;
}

function requireUsageUrl(url: string, assetId?: string): string {
  const parsed = new URL(stockMediaExternalUrlSchema.parse(url));
  const expectedPath = assetId
    ? `/photos/${encodeURIComponent(assetId)}/download`
    : undefined;
  if (
    parsed.hostname !== "api.unsplash.com" ||
    (expectedPath && parsed.pathname !== expectedPath)
  ) {
    throw new StockError(
      "Unsplash returned an invalid download tracking endpoint",
      502,
      "unsplash",
    );
  }
  return parsed.toString();
}

function pageFromToken(token: string | undefined): number {
  if (!token) return 1;
  if (!/^[1-9]\d{0,8}$/.test(token)) {
    throw new StockError("Invalid Unsplash page token", 400, "unsplash");
  }
  return Number(token);
}

function headerInteger(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) return undefined;
  if (!/^\d+$/.test(value.trim())) {
    throw new StockError(
      `Unsplash returned an invalid ${name} header`,
      502,
      "unsplash",
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new StockError(
      `Unsplash returned an invalid ${name} header`,
      502,
      "unsplash",
    );
  }
  return parsed;
}

function quotaFromHeaders(
  headers: Headers,
  observedAt: Date,
): StockMediaQuotaState | undefined {
  const limit = headerInteger(headers, "X-Ratelimit-Limit");
  const remaining = headerInteger(headers, "X-Ratelimit-Remaining");
  if (limit === undefined && remaining === undefined) return undefined;
  if (limit === undefined || remaining === undefined) {
    throw new StockError(
      "Unsplash returned incomplete rate-limit headers",
      502,
      "unsplash",
    );
  }
  return stockMediaQuotaStateSchema.parse({
    limit,
    remaining,
    observedAt: observedAt.toISOString(),
    metadata: { period: "hour" },
  });
}

function candidateFromPhoto(photo: UnsplashPhoto): StockMediaCandidate {
  const url = requireUnsplashImageUrl(photo.urls.regular ?? photo.urls.full!);
  const previewUrl = requireUnsplashImageUrl(photo.urls.small ?? url);
  const scale = photo.urls.regular ? Math.min(1, 1080 / photo.width) : 1;
  const width = Math.max(1, Math.round(photo.width * scale));
  const height = Math.max(1, Math.round(photo.height * scale));
  return stockMediaCandidateSchema.parse({
    providerId: "unsplash",
    providerAssetId: photo.id,
    kind: "image",
    previewUrl,
    sourcePageUrl: appendReferral(photo.links.html),
    creator: photo.user.name,
    creatorUrl: appendReferral(photo.user.links.html),
    width,
    height,
    orientation: orientationFromDims(width, height),
    renderRenditions: [{ id: "hotlink", url, width, height }],
    attribution: {
      text: `Photo by ${photo.user.name} on Unsplash`,
      required: true,
      licenseName: "Unsplash License",
      licenseUrl: UNSPLASH_LICENSE_URL,
    },
    acquisitionPolicy: "hotlink",
    usageReportUrl: requireUsageUrl(photo.links.download_location, photo.id),
  });
}

function providerHttpError(status: number): StockError {
  if (status === 401 || status === 403) {
    return new StockError(
      `Unsplash rejected the API key (HTTP ${status}). Check it in Settings.`,
      status,
      "unsplash",
    );
  }
  if (status === 429) {
    return new StockError(
      "Unsplash rate limit exceeded. Wait for the current window to reset.",
      status,
      "unsplash",
    );
  }
  return new StockError(
    `Unsplash request failed (HTTP ${status}).`,
    status,
    "unsplash",
  );
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return {
    timeoutSignal,
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  };
}

async function fetchOnce(options: {
  url: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<Response> {
  const combined = requestSignal(options.signal, options.timeoutMs);
  try {
    return await options.fetchImpl(options.url, {
      method: "GET",
      headers: {
        Authorization: `Client-ID ${options.apiKey}`,
        "Accept-Version": "v1",
        Accept: "application/json",
      },
      redirect: "error",
      signal: combined.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (combined.timeoutSignal.aborted) {
      throw new StockError(
        "Unsplash request timed out without retrying.",
        504,
        "unsplash",
      );
    }
    throw new StockError(
      "Unsplash request could not reach the provider.",
      502,
      "unsplash",
    );
  }
}

/** Provider-neutral Unsplash adapter. Required image URLs are always hotlinked. */
export function createUnsplashMediaProvider(
  options: UnsplashProviderOptions = {},
): StockMediaProvider {
  const key =
    options.apiKey ?? (() => process.env.UNSPLASH_ACCESS_KEY?.trim() || "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new Error(
      "Unsplash request timeout must be between 1ms and 60 seconds",
    );
  }

  const requireKey = () => {
    const apiKey = key();
    if (!apiKey) {
      throw new StockError(
        "Unsplash has no API key. Add one in Settings.",
        400,
        "unsplash",
      );
    }
    return apiKey;
  };

  return {
    id: "unsplash",
    label: "Unsplash",
    capabilities: {
      kinds: ["image"],
      acquisitionPolicies: ["hotlink"],
      maxPageSize: 30,
      supportsPagination: true,
      requiresApiKey: true,
      usageReporting: true,
      defaultCacheTtlSec: CACHE_TTL_SECONDS,
    },

    async health() {
      return {
        status: key() ? "ready" : "unconfigured",
        message: key()
          ? "Unsplash is configured; selected images require network access."
          : "Add UNSPLASH_ACCESS_KEY in Settings to enable Unsplash.",
        checkedAt: now().toISOString(),
      };
    },

    async search(
      input: NormalizedStockMediaSearchRequest,
      signal?: AbortSignal,
    ): Promise<StockMediaSearchResponse> {
      if (input.kind !== "image") {
        throw new StockError(
          "Unsplash does not support video search",
          400,
          "unsplash",
        );
      }
      const page = pageFromToken(input.pageToken);
      if (input.perPage > 30) {
        throw new StockError(
          "Unsplash supports at most 30 results per page",
          400,
          "unsplash",
        );
      }
      const params = new URLSearchParams({
        query: input.query,
        page: String(page),
        per_page: String(input.perPage),
        content_filter: "high",
      });
      if (input.orientation) {
        params.set("orientation", unsplashOrientation(input.orientation));
      }
      const observedAt = now();
      const response = await fetchOnce({
        url: `${UNSPLASH_API_BASE}/search/photos?${params}`,
        apiKey: requireKey(),
        fetchImpl,
        timeoutMs,
        signal,
      });
      if (!response.ok) throw providerHttpError(response.status);

      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new StockError(
          "Unsplash returned malformed JSON",
          502,
          "unsplash",
        );
      }
      const parsed = searchResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new StockError(
          "Unsplash returned an invalid search response",
          502,
          "unsplash",
        );
      }
      const nextPageToken =
        page < parsed.data.total_pages ? String(page + 1) : undefined;
      return stockMediaSearchResponseSchema.parse({
        items: parsed.data.results.map(candidateFromPhoto),
        nextPageToken,
        total: parsed.data.total,
        quota: quotaFromHeaders(response.headers, observedAt),
      });
    },

    async reportUsage(
      assetInput: ResolvedStockAsset,
      signal?: AbortSignal,
    ): Promise<StockMediaUsageEvent> {
      const asset = resolvedStockAssetSchema.parse(assetInput);
      if (asset.providerSnapshot.providerId !== "unsplash") {
        throw new StockError(
          "Stock asset does not belong to Unsplash",
          400,
          "unsplash",
        );
      }
      if (asset.usageEvent.state !== "pending") return asset.usageEvent;
      const reportUrl = asset.providerSnapshot.usageReportUrl;
      if (!reportUrl) {
        throw new StockError(
          "Unsplash selection has no persisted download tracking endpoint",
          409,
          "unsplash",
        );
      }
      const response = await fetchOnce({
        url: requireUsageUrl(reportUrl, asset.providerSnapshot.providerAssetId),
        apiKey: requireKey(),
        fetchImpl,
        timeoutMs,
        signal,
      });
      if (!response.ok) throw providerHttpError(response.status);
      try {
        usageResponseSchema.parse(await response.json());
      } catch {
        throw new StockError(
          "Unsplash returned an invalid usage response",
          502,
          "unsplash",
        );
      }
      return stockMediaUsageEventSchema.parse({
        state: "reported",
        reportedAt: now().toISOString(),
      });
    },
  };
}

/** Existing image-only wrapper, backed by the shared Unsplash adapter. */
export function createUnsplashProvider(
  options: UnsplashProviderOptions = {},
): StockProvider {
  const mediaProvider = createUnsplashMediaProvider(options);
  const snapshots = new Map<string, ResolvedStockAsset>();
  const clock = options.now ?? (() => new Date());
  return {
    id: "unsplash",
    label: "Unsplash",
    isConfigured: () =>
      (options.apiKey?.() ?? process.env.UNSPLASH_ACCESS_KEY?.trim() ?? "")
        .length > 0,
    async search(
      query: string,
      orientation: Orientation,
      count = 5,
    ): Promise<StockImage[]> {
      const result = await mediaProvider.search({
        query,
        kind: "image",
        orientation,
        perPage: Math.min(Math.max(count, 1), 30),
      });
      return result.items.map((candidate) => {
        const rendition = candidate.renderRenditions[0]!;
        const image: StockImage = {
          url: rendition.url,
          thumbUrl: candidate.previewUrl,
          credit: candidate.creator,
          creditUrl: candidate.creatorUrl ?? candidate.sourcePageUrl,
          downloadLocation: candidate.usageReportUrl,
        };
        const capturedAt = clock().toISOString();
        snapshots.set(
          rendition.url,
          resolvedStockAssetSchema.parse({
            schemaVersion: 1,
            resolvedAt: capturedAt,
            compliantRemoteUrl: rendition.url,
            providerSnapshot: candidate,
            sourceRevision: {
              capturedAt,
              termsUrl: UNSPLASH_API_GUIDELINES_URL,
            },
            selectedRendition: rendition,
            usageEvent: { state: "pending" },
          }),
        );
        return image;
      });
    },
    trackUsage(image: StockImage): void {
      const snapshot = snapshots.get(image.url);
      if (!snapshot || !mediaProvider.reportUsage) return;
      void mediaProvider.reportUsage(snapshot).catch(() => {});
    },
  };
}
