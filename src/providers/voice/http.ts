import { ProviderError, type ProviderId } from "./types";

/**
 * fetch wrapper that maps transport and HTTP errors to ProviderError with
 * actionable messages (so the UI can show "check your key" rather than a raw
 * stack). Returns the Response on 2xx.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  providerId: ProviderId,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ProviderError(
      `Could not reach ${providerId}. Check your connection. (${(e as Error).message})`,
      502,
      providerId,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        `${providerId} rejected the API key (HTTP ${res.status}). Add or update it in Settings.`,
        res.status,
        providerId,
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        `${providerId} rate limit hit (HTTP 429). Wait a moment and retry.`,
        429,
        providerId,
      );
    }
    const detail = body ? `: ${body.slice(0, 300)}` : "";
    throw new ProviderError(
      `${providerId} request failed (HTTP ${res.status})${detail}`,
      res.status,
      providerId,
    );
  }

  return res;
}
