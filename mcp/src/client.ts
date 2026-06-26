/**
 * Authenticated HTTP client for the Reel Studio REST API.
 *
 * The MCP server NEVER touches the database or repository layer directly — it
 * speaks only to the running app over HTTP, presenting a bearer token. This
 * keeps the security boundary in one place (the app's per-route authorize()).
 */

export const BASE_URL = (
  process.env.REEL_STUDIO_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");

const TOKEN = process.env.REEL_STUDIO_MCP_TOKEN;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Absolute URL for a possibly-relative path returned by the API (e.g. media URLs). */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!TOKEN) {
    throw new Error(
      "REEL_STUDIO_MCP_TOKEN is not set. Generate one in Reel Studio → Settings → AI tools / MCP and add it to your MCP config.",
    );
  }

  const res = await fetch(absoluteUrl(path), {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message =
      (json.error as string) ||
      (res.status === 401 || res.status === 403
        ? "Unauthorized — check that REEL_STUDIO_MCP_TOKEN matches the token in Settings."
        : `Request failed (HTTP ${res.status})`);
    throw new ApiError(message, res.status);
  }
  return json as T;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body ?? {});
export const apiPatch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body ?? {});

/** GET an endpoint that returns plain text (e.g. an SRT/VTT subtitle file). */
export async function apiGetText(path: string): Promise<string> {
  if (!TOKEN) {
    throw new Error("REEL_STUDIO_MCP_TOKEN is not set.");
  }
  const res = await fetch(absoluteUrl(path), {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(text || `Request failed (HTTP ${res.status})`, res.status);
  }
  return text;
}

export const encode = (s: string) => encodeURIComponent(s);
