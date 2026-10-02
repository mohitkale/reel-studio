import { fetchWithDeadline } from "@/lib/deadline-fetch";
import { z } from "zod";
import {
  type MusicProvider,
  type RemoteMusicTrack,
  MusicProviderError,
} from "./types";

const API_BASE = "https://api.jamendo.com/v3.0";

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
        throw new MusicProviderError(
          "Jamendo has no Client ID.",
          400,
          "jamendo",
        );
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

      const res = await fetchWithDeadline(
        `${API_BASE}/tracks/?${params}`,
        {},
        30_000,
        (error) => {
          const timedOut =
            error instanceof Error && error.name === "TimeoutError";
          return new MusicProviderError(
            timedOut ? "Jamendo search timed out" : "Could not reach Jamendo",
            timedOut ? 504 : 502,
            "jamendo",
          );
        },
      );
      if (!res.ok) {
        throw new MusicProviderError(
          `Jamendo search failed (HTTP ${res.status}).`,
          res.status,
          "jamendo",
        );
      }

      const json = z
        .object({
          results: z
            .array(
              z.object({
                id: z.string().optional(),
                name: z.string().optional(),
                artist_name: z.string().optional(),
                duration: z.number().optional(),
                audio: z.string().optional(),
                audiodownload: z.string().optional(),
                license_ccurl: z.string().optional(),
                shareurl: z.string().optional(),
              }),
            )
            .default([]),
        })
        .parse(await res.json());
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
