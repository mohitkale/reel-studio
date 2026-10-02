import { fetchWithDeadline } from "@/lib/deadline-fetch";
import { ProviderError } from "@/providers/voice/types";
/**
 * Server-only helpers for talking to a self-hosted VoiceForge instance.
 * Keeps VOICEFORGE_API_TOKEN off the client — browser code uses /api/voiceforge/*.
 */

export function voiceforgeBaseUrl(): string {
  return process.env.VOICEFORGE_SERVICE_URL?.trim().replace(/\/$/, "") ?? "";
}

export function isVoiceforgeConfigured(): boolean {
  return voiceforgeBaseUrl().length > 0;
}

/** Authorization headers when VOICEFORGE_API_TOKEN is set. */
export function voiceforgeAuthHeaders(): Record<string, string> {
  const token = process.env.VOICEFORGE_API_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Same-origin proxy URL for voice preview clips (AudioPreview in the browser). */
export function voiceforgePreviewProxyUrl(voiceId: string): string {
  return `/api/voiceforge/voices/${encodeURIComponent(voiceId)}/preview`;
}

/** Bound both HTTP negotiation and body consumption for every proxy operation. */
export function voiceforgeFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
) {
  return fetchWithDeadline(url, init, timeoutMs, (error) => {
    if (init.signal?.aborted) return init.signal.reason ?? error;
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return new ProviderError(
      timedOut ? "VoiceForge request timed out" : "Could not reach VoiceForge",
      timedOut ? 504 : 502,
      "voiceforge",
    );
  });
}
