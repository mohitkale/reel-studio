import { isPublicIpAddress } from "@/lib/public-address";
/**
 * Client-safe media URL checks (no Node builtins) for Zod / shared validation.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/** Hostname-only defense for shared validation. Server downloads must pin DNS. */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (
    !h ||
    BLOCKED_HOSTNAMES.has(h) ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  )
    return true;
  let canonical: string;
  try {
    canonical = new URL(
      h.includes(":") ? `http://[${h}]` : `http://${h}`,
    ).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  if (canonical.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(canonical))
    return !isPublicIpAddress(canonical);
  return false;
}

/**
 * Validate a scene/background/media URL stored in the DB.
 * Allows app-relative `/media/…` and `/music/…`, plus public http(s) URLs.
 */
export function assertSafeMediaUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new Error("Invalid media URL");
  }
  if (trimmed.includes("\0") || trimmed.includes("\\")) {
    throw new Error("Invalid media URL");
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (
      (!trimmed.startsWith("/media/") && !trimmed.startsWith("/music/")) ||
      trimmed.includes("..")
    ) {
      throw new Error("Relative media URLs must be under /media/ or /music/");
    }
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid media URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) media URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Media URLs must not include credentials");
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error("Private or local network media URLs are not allowed");
  }
}
