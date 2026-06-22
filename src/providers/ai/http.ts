import { AIError, type AIProviderId } from "./types";

// Transient statuses worth retrying (Gemini flash often returns 503 under load).
const RETRYABLE = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch wrapper with backoff retry on transient errors, mapping failures to
 * AIError with actionable messages. Returns the Response on 2xx.
 */
export async function aiFetch(
  url: string,
  init: RequestInit,
  providerId: AIProviderId,
): Promise<Response> {
  let lastBody = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw new AIError(
        `Could not reach ${providerId}. Check your connection. (${(e as Error).message})`,
        502,
        providerId,
      );
    }

    if (res.ok) return res;

    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");

    if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    break;
  }

  if (lastStatus === 401 || lastStatus === 403) {
    throw new AIError(
      `${providerId} rejected the API key (HTTP ${lastStatus}). Add or update it in Settings.`,
      lastStatus,
      providerId,
    );
  }
  if (lastStatus === 429) {
    throw new AIError(
      `${providerId} rate limit or quota hit (HTTP 429). Wait a moment and retry.`,
      429,
      providerId,
    );
  }
  if (lastStatus === 503) {
    throw new AIError(
      `${providerId} is busy right now (HTTP 503). This is usually temporary - please try again.`,
      503,
      providerId,
    );
  }
  const detail = lastBody ? `: ${lastBody.slice(0, 300)}` : "";
  throw new AIError(
    `${providerId} request failed (HTTP ${lastStatus})${detail}`,
    lastStatus || 502,
    providerId,
  );
}
