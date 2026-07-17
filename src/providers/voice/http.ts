import { ProviderError, type ProviderId } from "./types";

export type ProviderFetchOptions = {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
};

/**
 * fetch wrapper that maps transport and HTTP errors to ProviderError with
 * actionable messages (so the UI can show "check your key" rather than a raw
 * stack). Returns the Response on 2xx.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  providerId: ProviderId,
  options?: ProviderFetchOptions,
): Promise<Response> {
  let res: Response;
  const timeoutMs = options?.timeoutMs;
  const timeoutController =
    timeoutMs && timeoutMs > 0 && !init.signal ? new AbortController() : null;
  const timer = timeoutController
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;

  try {
    res = await fetch(url, {
      ...init,
      signal: init.signal ?? timeoutController?.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError");
    if (aborted && timeoutMs) {
      throw new ProviderError(
        `${providerId} timed out after ${Math.round(timeoutMs / 1000)}s. Check that the service is running and not overloaded.`,
        504,
        providerId,
      );
    }
    throw new ProviderError(
      `Could not reach ${providerId}. Check your connection. (${(e as Error).message})`,
      502,
      providerId,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 300)}` : "";
    const lower = body.toLowerCase();

    // Plan/feature gates often come back as 401/403 with a clear body — don't
    // tell the user their API key is wrong when the key is fine but the tier
    // blocks the requested format/model.
    if (
      (res.status === 401 || res.status === 403) &&
      (lower.includes("subscription_required") ||
        lower.includes("output_format") ||
        lower.includes("output format") ||
        lower.includes("not_allowed") ||
        lower.includes("pro tier"))
    ) {
      throw new ProviderError(
        `${providerId} plan does not allow this request (HTTP ${res.status})${detail}`,
        res.status,
        providerId,
      );
    }
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
    throw new ProviderError(
      `${providerId} request failed (HTTP ${res.status})${detail}`,
      res.status,
      providerId,
    );
  }

  return res;
}
