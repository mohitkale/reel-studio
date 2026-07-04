/**
 * External free-music provider contract, mirroring the stock-image/voice
 * provider pattern. Adding a vendor means one new file + a registry entry.
 */

export const MUSIC_PROVIDER_IDS = ["jamendo"] as const;
export type MusicProviderId = (typeof MUSIC_PROVIDER_IDS)[number];

export interface RemoteMusicTrack {
  id: string;
  name: string;
  artist: string;
  /** Direct, hotlinkable audio URL (works as an <audio>/<Audio> src). */
  url: string;
  durationSeconds?: number;
  /** Human-readable credit line to show alongside the track, e.g. "Track by Artist — Jamendo, CC BY-NC-ND". */
  attribution: string;
  /** Link to the track's page on the provider's site. */
  sourceUrl: string;
}

export interface MusicProvider {
  id: MusicProviderId;
  label: string;
  isConfigured(): boolean;
  /** Search for tracks matching a free-text query (genre/mood/vibe words work well). */
  search(query: string, count?: number): Promise<RemoteMusicTrack[]>;
}

export class MusicProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerId?: MusicProviderId,
  ) {
    super(message);
    this.name = "MusicProviderError";
  }
}
