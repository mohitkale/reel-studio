import { type MusicProvider, type RemoteMusicTrack, MusicProviderError } from "./types";

const API_BASE = "https://api.jamendo.com/v3.0";

interface JamendoTrack {
  id?: string;
  name?: string;
  artist_name?: string;
  duration?: number;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
  shareurl?: string;
}

/** Turn a Jamendo Creative Commons license URL into a short, readable label. */
function licenseLabel(url: string | undefined): string {
  if (!url) return "Creative Commons";
  const m = url.match(/licenses\/([a-z-]+)\//i);
  return m ? `CC ${m[1].toUpperCase()}` : "Creative Commons";
}

/**
 * Jamendo free-music provider (600k+ independent-artist tracks, Creative
 * Commons licensed). Free Client ID from devportal.jamendo.com; no OAuth
 * needed for search/streaming.
 */
export function createJamendoProvider(): MusicProvider {
  const clientId = () => process.env.JAMENDO_CLIENT_ID?.trim() || "";

  return {
    id: "jamendo",
    label: "Jamendo",

    isConfigured: () => clientId().length > 0,

    async search(query: string, count = 8): Promise<RemoteMusicTrack[]> {
      if (!clientId()) {
        throw new MusicProviderError("Jamendo has no Client ID.", 400, "jamendo");
      }
      const params = new URLSearchParams({
        client_id: clientId(),
        format: "json",
        search: query,
        limit: String(Math.min(Math.max(count, 1), 20)),
        include: "musicinfo",
        audioformat: "mp32",
        boost: "popularity_total",
      });

      const res = await fetch(`${API_BASE}/tracks/?${params}`);
      if (!res.ok) {
        throw new MusicProviderError(
          `Jamendo search failed (HTTP ${res.status}).`,
          res.status,
          "jamendo",
        );
      }

      const json = (await res.json()) as { results?: JamendoTrack[] };
      return (json.results ?? [])
        .map((t): RemoteMusicTrack | null => {
          const url = t.audio ?? t.audiodownload;
          if (!url || !t.id || !t.name) return null;
          const artist = t.artist_name ?? "Unknown artist";
          return {
            id: t.id,
            name: t.name,
            artist,
            url,
            durationSeconds: t.duration,
            attribution: `"${t.name}" by ${artist} — Jamendo, ${licenseLabel(t.license_ccurl)}`,
            sourceUrl: t.shareurl ?? `https://www.jamendo.com/track/${t.id}`,
          };
        })
        .filter((x): x is RemoteMusicTrack => x !== null);
    },
  };
}
