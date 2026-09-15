import { AIError } from "./types";
import {
  LocalAIEndpointError,
  validateLocalAIEndpoint,
} from "./local-endpoint";
import type { LocalAIProviderId } from "./local-types";

export interface LocalAIRequestOptions {
  providerId: LocalAIProviderId;
  baseUrl: string;
  allowLan: boolean;
  path: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function secureLocalAIFetch(
  options: LocalAIRequestOptions,
): Promise<Response> {
  const endpoint = await validateLocalAIEndpoint(
    options.baseUrl,
    options.allowLan,
  );
  const base = new URL(`${endpoint.baseUrl}/`);
  const target = new URL(options.path.replace(/^\/+/, ""), base);
  if (target.origin !== base.origin) {
    throw new LocalAIEndpointError(
      "Local AI request path changed the configured endpoint origin.",
      options.providerId,
    );
  }

  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 5_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  let response: Response;
  try {
    response = await fetch(target, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal,
      redirect: "manual",
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new AIError(
        `${options.providerId} request was cancelled.`,
        499,
        options.providerId,
      );
    }
    if (timeoutSignal.aborted) {
      throw new AIError(
        `${options.providerId} did not respond within ${options.timeoutMs ?? 5_000}ms.`,
        504,
        options.providerId,
      );
    }
    throw new AIError(
      `${options.providerId} server is offline or unreachable. Start the server and check its URL. (${error instanceof Error ? error.message : String(error)})`,
      503,
      options.providerId,
    );
  }

  if (response.status >= 300 && response.status < 400) {
    throw new AIError(
      `${options.providerId} returned a redirect. Configure the final local endpoint URL directly.`,
      502,
      options.providerId,
    );
  }
  return response;
}
