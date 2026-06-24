import { type Orientation, unsplashOrientation } from "@/lib/orientation";
import { type StockImage, type StockProvider, StockError } from "./types";

const API_BASE = "https://api.unsplash.com";

interface UnsplashPhoto {
  urls?: { regular?: string; small?: string; full?: string };
  links?: { html?: string; download_location?: string };
  user?: { name?: string; links?: { html?: string } };
}

/**
 * Unsplash stock-image provider. Uses the free Unsplash API (Demo tier is
 * ~50 requests/hour). The key is used only at generation time to search; the
 * returned CDN URL is hotlinked directly into the render (no download to disk).
 */
export function createUnsplashProvider(): StockProvider {
  const key = () => process.env.UNSPLASH_ACCESS_KEY?.trim() || "";

  return {
    id: "unsplash",
    label: "Unsplash",

    isConfigured: () => key().length > 0,

    async search(
      query: string,
      orientation: Orientation,
      count = 5,
    ): Promise<StockImage[]> {
      if (!key()) {
        throw new StockError("Unsplash has no API key.", 400, "unsplash");
      }
      const params = new URLSearchParams({
        query,
        orientation: unsplashOrientation(orientation),
        per_page: String(Math.min(Math.max(count, 1), 30)),
        content_filter: "high",
      });

      const res = await fetch(`${API_BASE}/search/photos?${params}`, {
        headers: {
          Authorization: `Client-ID ${key()}`,
          "Accept-Version": "v1",
        },
      });

      if (res.status === 401 || res.status === 403) {
        throw new StockError(
          `Unsplash rejected the API key (HTTP ${res.status}). Check it in Settings.`,
          res.status,
          "unsplash",
        );
      }
      if (!res.ok) {
        throw new StockError(
          `Unsplash search failed (HTTP ${res.status}).`,
          res.status,
          "unsplash",
        );
      }

      const json = (await res.json()) as { results?: UnsplashPhoto[] };
      return (json.results ?? [])
        .map((p): StockImage | null => {
          const url = p.urls?.regular ?? p.urls?.full;
          if (!url) return null;
          return {
            url,
            thumbUrl: p.urls?.small ?? url,
            credit: p.user?.name ?? "Unsplash",
            creditUrl: p.user?.links?.html ?? p.links?.html ?? "https://unsplash.com",
            downloadLocation: p.links?.download_location,
          };
        })
        .filter((x): x is StockImage => x !== null);
    },

    // Unsplash API guideline: ping the download endpoint when an image is used.
    // Fire-and-forget; failures are non-fatal.
    trackUsage(image: StockImage): void {
      if (!image.downloadLocation || !key()) return;
      void fetch(image.downloadLocation, {
        headers: { Authorization: `Client-ID ${key()}`, "Accept-Version": "v1" },
      }).catch(() => {});
    },
  };
}
