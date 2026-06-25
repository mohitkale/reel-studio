import { timingSafeEqual } from "node:crypto";

import { getMcpToken, hasMcpToken } from "@/server/secrets";
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

function isSameOrigin(req: Request): boolean {
  // Browsers stamp first-party fetches with Sec-Fetch-Site. `same-origin` is a
  // page-initiated request to its own origin; `none` is a direct navigation.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return true;

  // Fall back to comparing the Origin header against the request's own origin.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(req.url).origin;
    } catch {
      return false;
    }
  }

  // No Sec-Fetch-Site (older clients) and no Origin header: treat as same-origin
  // only when there is no MCP token configured at all, so a token-less local
  // setup keeps working. Once a token exists, unidentified clients are rejected.
  return !hasMcpToken();
}

/**
 * Authorize a mutating request. Throws `ProviderError(401)` if neither a valid
 * MCP token nor a same-origin web request is detected.
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

/** Reject MCP-origin requests outright (used on endpoints reserved for the web UI). */
export function requireWeb(req: Request): void {
  if (authorize(req) !== "web") {
    throw new ProviderError("This action is only available in the web app", 403);
  }
}
