import type { Orientation } from "@/lib/orientation";

/**
 * Stock-image provider contract. The app talks only to this interface; adding a
 * vendor (Pexels, Pixabay, ...) means one new file + a registry entry, mirroring
 * the voice/AI provider pattern.
 */

export const STOCK_PROVIDER_IDS = ["unsplash"] as const;
export type StockProviderId = (typeof STOCK_PROVIDER_IDS)[number];

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
  search(query: string, orientation: Orientation, count?: number): Promise<StockImage[]>;
  /** Optional: notify the provider an image was used (vendor API guideline). */
  trackUsage?(image: StockImage): void;
}

export class StockError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerId?: StockProviderId,
  ) {
    super(message);
    this.name = "StockError";
  }
}
