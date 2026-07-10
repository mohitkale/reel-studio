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
