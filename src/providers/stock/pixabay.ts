import { z } from "zod";

import { dimsFor, orientationFromDims } from "@/lib/orientation";
import {
  stockMediaCandidateSchema,
  stockMediaExternalUrlSchema,
  stockMediaQuotaStateSchema,
  stockMediaRenditionSchema,
  type NormalizedStockMediaSearchRequest,
  type StockMediaCandidate,
  type StockMediaKind,
  type StockMediaQuotaState,
  type StockMediaRendition,
  type StockMediaSearchResponse,
} from "./schemas";
import {
  StockError,
  type StockMediaProvider,
  type StockMediaProviderResolution,
} from "./types";

const PIXABAY_API_BASE = "https://pixabay.com/api";
export const PIXABAY_API_DOCUMENTATION_URL = "https://pixabay.com/api/docs/";
export const PIXABAY_LICENSE_URL =
  "https://pixabay.com/service/license-summary/";
const DEFAULT_TIMEOUT_MS = 15_000;
const CACHE_TTL_SECONDS = 86_400;

const positiveIntegerSchema = z.number().int().positive().max(2_147_483_647);
const nonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const pixabayImageSchema = z.object({
  id: positiveIntegerSchema,
  pageURL: stockMediaExternalUrlSchema,
  previewURL: stockMediaExternalUrlSchema,
  previewWidth: positiveIntegerSchema,
  previewHeight: positiveIntegerSchema,
  webformatURL: stockMediaExternalUrlSchema,
  webformatWidth: positiveIntegerSchema,
  webformatHeight: positiveIntegerSchema,
  imageURL: stockMediaExternalUrlSchema.optional(),
  imageWidth: positiveIntegerSchema,
  imageHeight: positiveIntegerSchema,
  imageSize: positiveIntegerSchema.optional(),
  user_id: nonnegativeIntegerSchema,
  user: z.string().trim().max(240),
});

const mediaUrlOrEmptySchema = z.union([
  z.literal(""),
  stockMediaExternalUrlSchema,
]);

const pixabayVideoFileSchema = z
  .object({
    url: mediaUrlOrEmptySchema,
    width: nonnegativeIntegerSchema,
    height: nonnegativeIntegerSchema,
    size: nonnegativeIntegerSchema,
    thumbnail: mediaUrlOrEmptySchema,
  })
  .superRefine((file, ctx) => {
    if (file.url && (!file.width || !file.height || !file.size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Available Pixabay video files require dimensions and size",
      });
    }
  });

const pixabayVideoSchema = z.object({
  id: positiveIntegerSchema,
  pageURL: stockMediaExternalUrlSchema,
  duration: z.number().finite().positive().max(86_400),
  videos: z.object({
    large: pixabayVideoFileSchema.optional(),
    medium: pixabayVideoFileSchema.optional(),
    small: pixabayVideoFileSchema.optional(),
    tiny: pixabayVideoFileSchema.optional(),
  }),
  user_id: nonnegativeIntegerSchema,
  user: z.string().trim().max(240),
});

const pixabayImageSearchSchema = z.object({
  total: nonnegativeIntegerSchema,
  totalHits: nonnegativeIntegerSchema,
  hits: z.array(pixabayImageSchema).max(200),
});

const pixabayVideoSearchSchema = z.object({
  total: nonnegativeIntegerSchema,
  totalHits: nonnegativeIntegerSchema,
  hits: z.array(pixabayVideoSchema).max(200),
});

type PixabayImage = z.infer<typeof pixabayImageSchema>;
type PixabayVideo = z.infer<typeof pixabayVideoSchema>;

export interface PixabayProviderOptions {
  apiKey?: () => string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

function pageFromToken(token: string | undefined): number {
  if (!token) return 1;
  if (!/^[1-9]\d{0,8}$/.test(token)) {
    throw new StockError("Invalid Pixabay page token", 400, "pixabay");
  }
  return Number(token);
}

function headerInteger(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) return undefined;
  if (!/^\d+$/.test(value.trim())) {
    throw new StockError(
      `Pixabay returned an invalid ${name} header`,
      502,
      "pixabay",
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new StockError(
      `Pixabay returned an invalid ${name} header`,
      502,
      "pixabay",
    );
  }
  return parsed;
}

function quotaFromHeaders(
  headers: Headers,
  observedAt: Date,
): StockMediaQuotaState | undefined {
  const limit = headerInteger(headers, "X-RateLimit-Limit");
  const remaining = headerInteger(headers, "X-RateLimit-Remaining");
  const resetSeconds = headerInteger(headers, "X-RateLimit-Reset");
  if (
    limit === undefined &&
    remaining === undefined &&
    resetSeconds === undefined
  ) {
    return undefined;
  }
  if (
    limit === undefined ||
    remaining === undefined ||
    resetSeconds === undefined
  ) {
    throw new StockError(
      "Pixabay returned incomplete rate-limit headers",
      502,
      "pixabay",
    );
  }
  const resetAt = new Date(observedAt.getTime() + resetSeconds * 1000);
  try {
    return stockMediaQuotaStateSchema.parse({
      limit,
      remaining,
      resetAt: resetAt.toISOString(),
      observedAt: observedAt.toISOString(),
      metadata: { period: "60-seconds" },
    });
  } catch {
    throw new StockError(
      "Pixabay returned inconsistent rate-limit headers",
      502,
      "pixabay",
    );
  }
}

function creatorName(user: string): string {
  return user || "Pixabay";
}

function creatorUrl(user: string, userId: number): string | undefined {
  if (!user || !userId) return undefined;
  return `https://pixabay.com/users/${encodeURIComponent(user)}-${userId}/`;
}

function attribution(creator: string, kind: "Image" | "Video") {
  return {
    text: `${kind} by ${creator} on Pixabay`,
    required: true,
    licenseName: "Pixabay Content License",
    licenseUrl: PIXABAY_LICENSE_URL,
  } as const;
}

function imageCandidate(image: PixabayImage): StockMediaCandidate {
  const creator = creatorName(image.user);
  const renditions: StockMediaRendition[] = [];
  if (image.imageURL) {
    renditions.push(
      stockMediaRenditionSchema.parse({
        id: "original",
        url: image.imageURL,
        width: image.imageWidth,
        height: image.imageHeight,
        fileSizeBytes: image.imageSize,
      }),
    );
  }
  renditions.push(
    stockMediaRenditionSchema.parse({
      id: "webformat",
      url: image.webformatURL,
      width: image.webformatWidth,
      height: image.webformatHeight,
    }),
  );
  return stockMediaCandidateSchema.parse({
    providerId: "pixabay",
    providerAssetId: String(image.id),
    kind: "image",
    previewUrl: image.previewURL,
    sourcePageUrl: image.pageURL,
    creator,
    creatorUrl: creatorUrl(image.user, image.user_id),
    width: image.imageWidth,
    height: image.imageHeight,
    orientation: orientationFromDims(image.imageWidth, image.imageHeight),
    renderRenditions: renditions,
    attribution: attribution(creator, "Image"),
    acquisitionPolicy: "download",
  });
}

const VIDEO_RENDITION_ORDER = ["large", "medium", "small", "tiny"] as const;

function videoRenditions(video: PixabayVideo): StockMediaRendition[] {
  return VIDEO_RENDITION_ORDER.flatMap((id) => {
    const file = video.videos[id];
    if (!file?.url || !file.width || !file.height || !file.size) return [];
    return [
      stockMediaRenditionSchema.parse({
        id,
        url: file.url,
        width: file.width,
        height: file.height,
        mimeType: "video/mp4",
        fileSizeBytes: file.size,
        durationSec: video.duration,
      }),
    ];
  });
}

function videoCandidate(video: PixabayVideo): StockMediaCandidate | null {
  const renderRenditions = videoRenditions(video);
  if (!renderRenditions.length) return null;
  const largest = [...renderRenditions].sort(
    (left, right) =>
      right.width * right.height - left.width * left.height ||
      left.id.localeCompare(right.id),
  )[0]!;
  const preview = VIDEO_RENDITION_ORDER.map(
    (id) => video.videos[id]?.thumbnail,
  ).find((url): url is string => Boolean(url));
  if (!preview) return null;
  const creator = creatorName(video.user);
  return stockMediaCandidateSchema.parse({
    providerId: "pixabay",
    providerAssetId: String(video.id),
    kind: "video",
    previewUrl: preview,
    sourcePageUrl: video.pageURL,
    creator,
    creatorUrl: creatorUrl(video.user, video.user_id),
    width: largest.width,
    height: largest.height,
    durationSec: video.duration,
    orientation: orientationFromDims(largest.width, largest.height),
    mimeType: "video/mp4",
    renderRenditions,
    attribution: attribution(creator, "Video"),
    acquisitionPolicy: "download",
  });
}

function providerHttpError(status: number): StockError {
  if (status === 400 || status === 401 || status === 403) {
    return new StockError(
      "Pixabay rejected the request or API key. Check it in Settings.",
      status,
      "pixabay",
    );
  }
  if (status === 429) {
    return new StockError(
      "Pixabay rate limit exceeded. Wait for the current window to reset.",
      status,
      "pixabay",
    );
  }
  if (status === 404 || status === 410) {
    return new StockError(
      "Pixabay media is no longer available.",
      status,
      "pixabay",
    );
  }
  return new StockError(
    `Pixabay search failed (HTTP ${status}).`,
    status,
    "pixabay",
  );
}

/** Choose a deterministic Pixabay rendition for validated local ingestion. */
export function selectPixabayRendition(
  candidateInput: StockMediaCandidate,
): StockMediaRendition {
  const candidate = stockMediaCandidateSchema.parse(candidateInput);
  if (candidate.providerId !== "pixabay") {
    throw new StockError(
      "Stock candidate does not belong to Pixabay",
      400,
      "pixabay",
    );
  }
  if (candidate.kind === "image") {
    return (
      candidate.renderRenditions.find((item) => item.id === "original") ??
      candidate.renderRenditions[0]!
    );
  }
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

/** Provider-neutral Pixabay image/video adapter. Requests are never retried. */
export function createPixabayProvider(
  options: PixabayProviderOptions = {},
): StockMediaProvider {
  const key =
    options.apiKey ?? (() => process.env.PIXABAY_API_KEY?.trim() || "");
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new Error(
      "Pixabay request timeout must be between 1ms and 60 seconds",
    );
  }

  const request = async (
    kind: StockMediaKind,
    params: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<{
    candidates: StockMediaCandidate[];
    total: number;
    quota?: StockMediaQuotaState;
  }> => {
    const apiKey = key();
    if (!apiKey) {
      throw new StockError(
        "Pixabay has no API key. Add one in Settings.",
        400,
        "pixabay",
      );
    }
    params.set("key", apiKey);
    const endpoint =
      kind === "image" ? `${PIXABAY_API_BASE}/` : `${PIXABAY_API_BASE}/videos/`;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    let response: Response;
    try {
      response = await (options.fetchImpl ?? fetch)(`${endpoint}?${params}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: requestSignal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timeoutSignal.aborted) {
        throw new StockError(
          "Pixabay search timed out without retrying.",
          504,
          "pixabay",
        );
      }
      throw new StockError(
        "Pixabay search could not reach the provider.",
        502,
        "pixabay",
      );
    }
    if (!response.ok) throw providerHttpError(response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new StockError("Pixabay returned malformed JSON.", 502, "pixabay");
    }
    const quota = quotaFromHeaders(response.headers, now());
    try {
      if (kind === "image") {
        const parsed = pixabayImageSearchSchema.parse(payload);
        return {
          candidates: parsed.hits.map(imageCandidate),
          total: parsed.totalHits,
          quota,
        };
      }
      const parsed = pixabayVideoSearchSchema.parse(payload);
      return {
        candidates: parsed.hits
          .map(videoCandidate)
          .filter((item): item is StockMediaCandidate => item !== null),
        total: parsed.totalHits,
        quota,
      };
    } catch (error) {
      if (error instanceof StockError) throw error;
      throw new StockError(
        "Pixabay returned a response that failed validation.",
        502,
        "pixabay",
      );
    }
  };

  return {
    id: "pixabay",
    label: "Pixabay",
    capabilities: {
      kinds: ["image", "video"],
      acquisitionPolicies: ["download"],
      maxPageSize: 100,
      supportsPagination: true,
      requiresApiKey: true,
      usageReporting: false,
      defaultCacheTtlSec: CACHE_TTL_SECONDS,
    },

    async health() {
      const configured = Boolean(key());
      return {
        status: configured ? "ready" : "unconfigured",
        message: configured
          ? "Pixabay image and video search is configured."
          : "Add a Pixabay API key in Settings.",
        checkedAt: now().toISOString(),
      };
    },

    async search(
      input: NormalizedStockMediaSearchRequest,
      signal?: AbortSignal,
    ): Promise<StockMediaSearchResponse> {
      if (input.query.length > 100) {
        throw new StockError(
          "Pixabay search queries cannot exceed 100 characters",
          400,
          "pixabay",
        );
      }
      if (input.perPage < 3) {
        throw new StockError(
          "Pixabay requires at least 3 results per page",
          400,
          "pixabay",
        );
      }
      const page = pageFromToken(input.pageToken);
      const params = new URLSearchParams({
        q: input.query,
        page: String(page),
        per_page: String(input.perPage),
        safesearch: "true",
      });
      if (input.kind === "image") params.set("image_type", "photo");
      else params.set("video_type", "all");
      if (input.orientation) {
        params.set(
          "orientation",
          input.orientation === "portrait"
            ? "vertical"
            : input.orientation === "landscape"
              ? "horizontal"
              : "all",
        );
      }
      const result = await request(input.kind, params, signal);
      return {
        items: result.candidates,
        nextPageToken:
          page * input.perPage < result.total && result.candidates.length
            ? String(page + 1)
            : undefined,
        total: result.total,
        quota: result.quota,
      };
    },

    async resolve(
      candidateInput: StockMediaCandidate,
      renditionInput: StockMediaRendition,
      signal?: AbortSignal,
    ): Promise<StockMediaProviderResolution> {
      const candidate = stockMediaCandidateSchema.parse(candidateInput);
      const rendition = stockMediaRenditionSchema.parse(renditionInput);
      if (candidate.providerId !== "pixabay") {
        throw new StockError(
          "Stock candidate does not belong to Pixabay",
          400,
          "pixabay",
        );
      }
      const params = new URLSearchParams({
        id: candidate.providerAssetId,
        per_page: "3",
        safesearch: "true",
      });
      const result = await request(candidate.kind, params, signal);
      const refreshed = result.candidates.find(
        (item) => item.providerAssetId === candidate.providerAssetId,
      );
      const refreshedRendition = refreshed?.renderRenditions.find(
        (item) => item.id === rendition.id,
      );
      if (!refreshed || !refreshedRendition) {
        throw new StockError(
          "Pixabay media or rendition is no longer available.",
          410,
          "pixabay",
        );
      }
      return { candidate: refreshed, rendition: refreshedRendition };
    },
  };
}
