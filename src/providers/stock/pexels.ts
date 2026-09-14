import { z } from "zod";

import { dimsFor, orientationFromDims } from "@/lib/orientation";
import {
  stockMediaCandidateSchema,
  stockMediaExternalUrlSchema,
  stockMediaQuotaStateSchema,
  type NormalizedStockMediaSearchRequest,
  type StockMediaCandidate,
  type StockMediaQuotaState,
  type StockMediaRendition,
  type StockMediaSearchResponse,
} from "./schemas";
import { StockError, type StockMediaProvider } from "./types";

const PEXELS_API_BASE = "https://api.pexels.com/v1";
export const PEXELS_API_DOCUMENTATION_URL =
  "https://www.pexels.com/api/documentation/";
export const PEXELS_LICENSE_URL = "https://www.pexels.com/license/";
const DEFAULT_TIMEOUT_MS = 15_000;

const positiveIntegerSchema = z.number().int().positive().max(2_147_483_647);
const nonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const pexelsPhotoSchema = z.object({
  id: positiveIntegerSchema,
  width: positiveIntegerSchema,
  height: positiveIntegerSchema,
  url: stockMediaExternalUrlSchema,
  photographer: z.string().trim().min(1).max(240),
  photographer_url: stockMediaExternalUrlSchema,
  src: z.object({
    original: stockMediaExternalUrlSchema,
    medium: stockMediaExternalUrlSchema,
  }),
});

const pexelsPhotoSearchSchema = z.object({
  page: positiveIntegerSchema,
  per_page: positiveIntegerSchema.max(80),
  total_results: nonnegativeIntegerSchema,
  next_page: stockMediaExternalUrlSchema.optional(),
  photos: z.array(pexelsPhotoSchema).max(80),
});

const pexelsVideoFileSchema = z.object({
  id: positiveIntegerSchema,
  quality: z.string().trim().min(1).max(40),
  file_type: z.string().trim().min(1).max(120),
  width: positiveIntegerSchema.nullable(),
  height: positiveIntegerSchema.nullable(),
  link: stockMediaExternalUrlSchema,
});

const pexelsVideoSchema = z.object({
  id: positiveIntegerSchema,
  width: positiveIntegerSchema,
  height: positiveIntegerSchema,
  duration: z.number().finite().positive().max(86_400),
  url: stockMediaExternalUrlSchema,
  image: stockMediaExternalUrlSchema,
  user: z.object({
    name: z.string().trim().min(1).max(240),
    url: stockMediaExternalUrlSchema,
  }),
  video_files: z.array(pexelsVideoFileSchema).max(100),
});

const pexelsVideoSearchSchema = z.object({
  page: positiveIntegerSchema,
  per_page: positiveIntegerSchema.max(80),
  total_results: nonnegativeIntegerSchema,
  next_page: stockMediaExternalUrlSchema.optional(),
  videos: z.array(pexelsVideoSchema).max(80),
});

export interface PexelsProviderOptions {
  apiKey?: () => string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

function pageFromToken(token: string | undefined): number {
  if (!token) return 1;
  if (!/^[1-9]\d{0,8}$/.test(token)) {
    throw new StockError("Invalid Pexels page token", 400, "pexels");
  }
  return Number(token);
}

function headerInteger(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) return undefined;
  if (!/^\d+$/.test(value.trim())) {
    throw new StockError(
      `Pexels returned an invalid ${name} header`,
      502,
      "pexels",
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new StockError(
      `Pexels returned an invalid ${name} header`,
      502,
      "pexels",
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
  const reset = headerInteger(headers, "X-Ratelimit-Reset");
  if (limit === undefined && remaining === undefined && reset === undefined) {
    return undefined;
  }
  if (limit === undefined || remaining === undefined || reset === undefined) {
    throw new StockError(
      "Pexels returned incomplete rate-limit headers",
      502,
      "pexels",
    );
  }
  const resetDate = new Date(reset * 1000);
  if (Number.isNaN(resetDate.getTime())) {
    throw new StockError(
      "Pexels returned an invalid X-Ratelimit-Reset header",
      502,
      "pexels",
    );
  }
  try {
    return stockMediaQuotaStateSchema.parse({
      limit,
      remaining,
      resetAt: resetDate.toISOString(),
      observedAt: observedAt.toISOString(),
      metadata: { period: "monthly" },
    });
  } catch {
    throw new StockError(
      "Pexels returned inconsistent rate-limit headers",
      502,
      "pexels",
    );
  }
}

function attribution(creator: string, kind: "Photo" | "Video") {
  return {
    text: `${kind} by ${creator} on Pexels`,
    required: true,
    licenseName: "Pexels License",
    licenseUrl: PEXELS_LICENSE_URL,
  } as const;
}

function photoCandidate(
  photo: z.infer<typeof pexelsPhotoSchema>,
): StockMediaCandidate {
  return stockMediaCandidateSchema.parse({
    providerId: "pexels",
    providerAssetId: String(photo.id),
    kind: "image",
    previewUrl: photo.src.medium,
    sourcePageUrl: photo.url,
    creator: photo.photographer,
    creatorUrl: photo.photographer_url,
    width: photo.width,
    height: photo.height,
    orientation: orientationFromDims(photo.width, photo.height),
    renderRenditions: [
      {
        id: "original",
        url: photo.src.original,
        width: photo.width,
        height: photo.height,
      },
    ],
    attribution: attribution(photo.photographer, "Photo"),
    acquisitionPolicy: "download",
  });
}

function videoRenditions(
  video: z.infer<typeof pexelsVideoSchema>,
): StockMediaRendition[] {
  const seen = new Set<number>();
  return video.video_files
    .filter(
      (file) =>
        file.width !== null &&
        file.height !== null &&
        (file.file_type === "video/mp4" || file.file_type === "video/webm") &&
        !file.link.toLowerCase().includes(".m3u8"),
    )
    .filter((file) => {
      if (seen.has(file.id)) return false;
      seen.add(file.id);
      return true;
    })
    .map((file) => ({
      id: `file-${file.id}`,
      url: file.link,
      width: file.width!,
      height: file.height!,
      mimeType: file.file_type as "video/mp4" | "video/webm",
      durationSec: video.duration,
    }))
    .sort(
      (left, right) =>
        right.width * right.height - left.width * left.height ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 24);
}

function videoCandidate(
  video: z.infer<typeof pexelsVideoSchema>,
): StockMediaCandidate | null {
  const renderRenditions = videoRenditions(video);
  if (renderRenditions.length === 0) return null;
  return stockMediaCandidateSchema.parse({
    providerId: "pexels",
    providerAssetId: String(video.id),
    kind: "video",
    previewUrl: video.image,
    sourcePageUrl: video.url,
    creator: video.user.name,
    creatorUrl: video.user.url,
    width: video.width,
    height: video.height,
    durationSec: video.duration,
    orientation: orientationFromDims(video.width, video.height),
    renderRenditions,
    attribution: attribution(video.user.name, "Video"),
    acquisitionPolicy: "download",
  });
}

function nextPageToken(
  page: number,
  nextPageUrl: string | undefined,
): string | undefined {
  if (!nextPageUrl) return undefined;
  const url = new URL(nextPageUrl);
  if (
    url.hostname !== "api.pexels.com" ||
    !url.pathname.startsWith("/v1/") ||
    url.searchParams.get("page") !== String(page + 1)
  ) {
    throw new StockError(
      "Pexels returned an invalid next-page URL",
      502,
      "pexels",
    );
  }
  return String(page + 1);
}

function providerHttpError(status: number): StockError {
  if (status === 401) {
    return new StockError(
      "Pexels rejected the API key. Check it in Settings.",
      status,
      "pexels",
    );
  }
  if (status === 403) {
    return new StockError(
      "Pexels denied access to the requested media.",
      status,
      "pexels",
    );
  }
  if (status === 429) {
    return new StockError(
      "Pexels rate limit exceeded. Wait for the monthly quota to reset.",
      status,
      "pexels",
    );
  }
  return new StockError(
    `Pexels search failed (HTTP ${status}).`,
    status,
    "pexels",
  );
}

/** Choose a deterministic, renderable Pexels rendition for local ingestion. */
export function selectPexelsRendition(
  candidateInput: StockMediaCandidate,
): StockMediaRendition {
  const candidate = stockMediaCandidateSchema.parse(candidateInput);
  if (candidate.providerId !== "pexels") {
    throw new StockError(
      "Stock candidate does not belong to Pexels",
      400,
      "pexels",
    );
  }
  if (candidate.kind === "image") return candidate.renderRenditions[0]!;

  const target = dimsFor(candidate.orientation);
  const compatible = candidate.renderRenditions.filter(
    (rendition) =>
      rendition.width >= target.width && rendition.height >= target.height,
  );
  const choices = compatible.length
    ? compatible.sort(
        (left, right) =>
          left.width * left.height - right.width * right.height ||
          left.id.localeCompare(right.id),
      )
    : [...candidate.renderRenditions].sort(
        (left, right) =>
          right.width * right.height - left.width * left.height ||
          left.id.localeCompare(right.id),
      );
  return choices[0]!;
}

/** Provider-neutral Pexels photo/video adapter. Requests are never retried. */
export function createPexelsProvider(
  options: PexelsProviderOptions = {},
): StockMediaProvider {
  const key =
    options.apiKey ?? (() => process.env.PEXELS_API_KEY?.trim() || "");
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new Error(
      "Pexels request timeout must be between 1ms and 60 seconds",
    );
  }

  return {
    id: "pexels",
    label: "Pexels",
    capabilities: {
      kinds: ["image", "video"],
      acquisitionPolicies: ["download"],
      maxPageSize: 80,
      supportsPagination: true,
      requiresApiKey: true,
      usageReporting: false,
      defaultCacheTtlSec: 86_400,
    },

    async health() {
      const configured = Boolean(key());
      return {
        status: configured ? "ready" : "unconfigured",
        message: configured
          ? "Pexels photo and video search is configured."
          : "Add a Pexels API key in Settings.",
        checkedAt: now().toISOString(),
      };
    },

    async search(
      input: NormalizedStockMediaSearchRequest,
      signal?: AbortSignal,
    ): Promise<StockMediaSearchResponse> {
      const apiKey = key();
      if (!apiKey) {
        throw new StockError(
          "Pexels has no API key. Add one in Settings.",
          400,
          "pexels",
        );
      }
      const page = pageFromToken(input.pageToken);
      const endpoint = input.kind === "image" ? "/search" : "/videos/search";
      const params = new URLSearchParams({
        query: input.query,
        page: String(page),
        per_page: String(input.perPage),
      });
      if (input.orientation) params.set("orientation", input.orientation);

      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;
      let response: Response;
      try {
        response = await (options.fetchImpl ?? fetch)(
          `${PEXELS_API_BASE}${endpoint}?${params}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: apiKey,
            },
            redirect: "error",
            signal: requestSignal,
          },
        );
      } catch (error) {
        if (signal?.aborted) throw error;
        if (timeoutSignal.aborted) {
          throw new StockError(
            "Pexels search timed out without retrying.",
            504,
            "pexels",
          );
        }
        throw new StockError(
          "Pexels search could not reach the provider.",
          502,
          "pexels",
        );
      }
      if (!response.ok) throw providerHttpError(response.status);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new StockError("Pexels returned malformed JSON.", 502, "pexels");
      }

      const observedAt = now();
      const quota = quotaFromHeaders(response.headers, observedAt);
      try {
        if (input.kind === "image") {
          const parsed = pexelsPhotoSearchSchema.parse(payload);
          if (parsed.page !== page || parsed.per_page !== input.perPage) {
            throw new StockError(
              "Pexels returned inconsistent pagination metadata.",
              502,
              "pexels",
            );
          }
          return {
            items: parsed.photos.map(photoCandidate),
            nextPageToken: nextPageToken(parsed.page, parsed.next_page),
            total: parsed.total_results,
            quota,
          };
        }
        const parsed = pexelsVideoSearchSchema.parse(payload);
        if (parsed.page !== page || parsed.per_page !== input.perPage) {
          throw new StockError(
            "Pexels returned inconsistent pagination metadata.",
            502,
            "pexels",
          );
        }
        return {
          items: parsed.videos
            .map(videoCandidate)
            .filter((item): item is StockMediaCandidate => item !== null),
          nextPageToken: nextPageToken(parsed.page, parsed.next_page),
          total: parsed.total_results,
          quota,
        };
      } catch (error) {
        if (error instanceof StockError) throw error;
        throw new StockError(
          "Pexels returned a response that failed validation.",
          502,
          "pexels",
        );
      }
    },
  };
}
