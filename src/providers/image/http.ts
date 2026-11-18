import { validateLocalAIEndpoint } from "@/providers/ai/local-endpoint";

import { ImageProviderError } from "./types";

/**
 * Fetch from an image server the person runs. Only loopback addresses (or the
 * private network when they allowed it) are reachable, and redirects are not
 * followed, the same rules as the local writer.
 */
export async function imageFetch(
  config: { baseUrl: string; allowLan: boolean },
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const endpoint = await validateLocalAIEndpoint(
    config.baseUrl,
    config.allowLan,
  );
  const base = new URL(`${endpoint.baseUrl}/`);
  const target = new URL(path.replace(/^\/+/, ""), base);
  if (target.origin !== base.origin)
    throw new ImageProviderError(
      "The image request changed the server's address.",
      400,
    );
  const timeout = AbortSignal.timeout(init.timeoutMs ?? 10_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(target, {
      method: init.method ?? "GET",
      headers: init.body ? { "content-type": "application/json" } : undefined,
      body: init.body,
      signal,
      redirect: "manual",
    });
  } catch (error) {
    if (init.signal?.aborted)
      throw new ImageProviderError("The image request was cancelled.", 499);
    throw new ImageProviderError(
      timeout.aborted
        ? "The image server did not answer in time."
        : `The image server is not reachable. Start it and check the address. (${error instanceof Error ? error.message : String(error)})`,
      503,
    );
  }
  if (response.status >= 300 && response.status < 400)
    throw new ImageProviderError(
      "The image server redirected; use its final address.",
      502,
    );
  return response;
}
