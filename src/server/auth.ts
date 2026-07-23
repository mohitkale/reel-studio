import { timingSafeEqual } from "node:crypto";

import { getMcpToken } from "@/server/secrets";
import { ProviderError } from "@/providers/voice/types";

/**
 * Request authorization for API route handlers.
 *
 * The app has no user accounts; first-party browser requests are trusted by
 * same-origin, while external automation (the MCP server) must present a bearer
 * token. We verify per-handler — Next 16 deprecated `middleware.ts` in favour of
 * `proxy.ts` and explicitly warns that auth must be checked inside each handler,
 * not relied on at the proxy layer alone.
 *
 * Returns the request origin so handlers can apply origin-specific policy (e.g.
 * MCP-originated renders require human approval before they start).
 *
 * Local-first default: unidentified clients are only accepted when the request
 * Host is loopback (localhost / 127.0.0.1 / ::1). Binding to a LAN or public
 * interface without a bearer token rejects non-browser clients. Set
 * REEL_STRICT_AUTH=1 to require a token even on loopback.
 */
export type RequestOrigin = "web" | "mcp";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; compare against a same-length
  // buffer so the comparison itself never leaks length via early return.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (!header) return undefined;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return undefined;
  const token = rest.join(" ").trim();
  return token ? token : undefined;
}

/**
 * Hostname for auth decisions. Do not trust X-Forwarded-Host unless the
 * operator explicitly opts in (TRUST_PROXY=1) behind a known reverse proxy.
 */
export function requestHostname(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xf = req.headers.get("x-forwarded-host");
    if (xf) {
      return xf.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
    }
  }
  try {
    return new URL(req.url).hostname.toLowerCase();
  } catch {
    const host = req.headers.get("host") ?? "";
    return host.split(":")[0]?.toLowerCase() ?? "";
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0:0:0:0:0:0:0:1";
}

export function isLoopbackRequest(req: Request): boolean {
  return isLoopbackHostname(requestHostname(req));
}

function strictAuthEnabled(): boolean {
  const v = process.env.REEL_STRICT_AUTH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isSameOrigin(req: Request): boolean {
  // Browsers stamp first-party fetches with Sec-Fetch-Site. `same-origin` is a
  // page-initiated request (including media/audio subresources).
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;

  // Direct navigation (`none`) is only trusted on loopback so LAN/public hosts
  // cannot open /media or APIs by pasting a URL.
  if (fetchSite === "none") {
    return isLoopbackRequest(req) && !strictAuthEnabled();
  }

  // Fall back to comparing the Origin header against the request's own origin.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(req.url).origin;
    } catch {
      return false;
    }
  }

  // No browser signals: allow only loopback (local scripts / curl to localhost).
  // Never fail open on a LAN or public bind.
  if (strictAuthEnabled()) return false;
  return isLoopbackRequest(req);
}

/**
 * Authorize a mutating or sensitive request. Throws `ProviderError(401)` if
 * neither a valid MCP token nor a same-origin / loopback web request is detected.
 */
export function authorize(req: Request): RequestOrigin {
  const token = bearerToken(req);
  if (token) {
    const expected = getMcpToken();
    if (expected && constantTimeEquals(token, expected)) return "mcp";
    throw new ProviderError("Invalid MCP token", 401);
  }
  if (isSameOrigin(req)) return "web";
  throw new ProviderError("Unauthorized", 401);
}

/**
 * Authorize access to `/media/*`. Same rules as `authorize`, but intended for
 * subresource loads (audio/video/img) that cannot send Authorization headers.
 */
export function authorizeMedia(req: Request): void {
  authorize(req);
}

/** Reject MCP-origin requests outright (used on endpoints reserved for the web UI). */
export function requireWeb(req: Request): void {
  if (authorize(req) !== "web") {
    throw new ProviderError("This action is only available in the web app", 403);
  }
}
