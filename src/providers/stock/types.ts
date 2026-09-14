import type { Orientation } from "@/lib/orientation";
import type {
  NormalizedStockMediaSearchRequest,
  ResolvedStockAsset,
  StockMediaCandidate,
  StockMediaProviderCapabilities,
  StockMediaProviderHealth,
  StockMediaRendition,
  StockMediaSearchResponse,
} from "./schemas";

export type {
  NormalizedStockMediaSearchRequest,
  ResolvedStockAsset,
  StockMediaCandidate,
  StockMediaProviderCapabilities,
  StockMediaProviderHealth,
  StockMediaQuotaState,
  StockMediaRendition,
  StockMediaSearchRequest,
  StockMediaSearchResponse,
} from "./schemas";

/** Provider ids accepted by server-side stock-media key management. */
export const STOCK_PROVIDER_IDS = ["unsplash", "pexels", "pixabay"] as const;
export type StockProviderId = (typeof STOCK_PROVIDER_IDS)[number];

/** Legacy image-only contract retained until Unsplash moves to the shared service. */

export interface StockImage {
  /** Full-bleed image URL to use as a scene background. */
  url: string;
  /** Small thumbnail URL (for pickers/credits). */
  thumbUrl: string;
  /** Photographer name, for attribution. */
  credit: string;
  /** Link to the photographer / source page. */
  creditUrl: string;
  /**
   * Provider endpoint to ping when an image is actually used, per the vendor's
   * API guidelines (Unsplash requires triggering this). Optional.
   */
  downloadLocation?: string;
}

export interface StockProvider {
  id: StockProviderId;
  label: string;
  isConfigured(): boolean;
  /** Search for images matching `query`, sized for `orientation`. */
  search(
    query: string,
    orientation: Orientation,
    count?: number,
  ): Promise<StockImage[]>;
  /** Optional: notify the provider an image was used (vendor API guideline). */
  trackUsage?(image: StockImage): void;
}

/** Provider-neutral contract used by the local-first stock-media service. */
export interface StockMediaProvider {
  id: string;
  label: string;
  capabilities: StockMediaProviderCapabilities;
  health(): Promise<StockMediaProviderHealth>;
  search(
    input: NormalizedStockMediaSearchRequest,
    signal?: AbortSignal,
  ): Promise<StockMediaSearchResponse>;
  /** Refresh or authorize the selected rendition when a provider requires it. */
  resolve?(
    candidate: StockMediaCandidate,
    rendition: StockMediaRendition,
    signal?: AbortSignal,
  ): Promise<StockMediaProviderResolution>;
  reportUsage?(asset: ResolvedStockAsset, signal?: AbortSignal): Promise<void>;
}

export interface StockMediaProviderResolution {
  candidate: StockMediaCandidate;
  rendition: StockMediaRendition;
}

export class StockError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerId?: string,
  ) {
    super(message);
    this.name = "StockError";
  }
}
