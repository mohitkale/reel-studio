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

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = ((n << 8) | v) >>> 0;
  }
  return n;
}

/** True for loopback, link-local, private, and other non-public hosts. */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  const n = ipv4ToInt(h);
  if (n != null) {
    if (((n & 0xff000000) >>> 0) === 0x00000000) return true;
    if (((n & 0xff000000) >>> 0) === 0x0a000000) return true;
    if (((n & 0xff000000) >>> 0) === 0x7f000000) return true;
    if (((n & 0xffff0000) >>> 0) === 0xa9fe0000) return true;
    if (((n & 0xfff00000) >>> 0) === 0xac100000) return true;
    if (((n & 0xffff0000) >>> 0) === 0xc0a80000) return true;
    if (((n & 0xffc00000) >>> 0) === 0x64400000) return true;
    return false;
  }

  if (h.includes(":")) {
    if (
      h === "::" ||
      h.startsWith("fc") ||
      h.startsWith("fd") ||
      h.startsWith("fe80")
    ) {
      return true;
    }
  }

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
