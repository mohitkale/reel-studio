/**
 * Server-only path containment helpers.
 */

import path from "node:path";

export {
  assertSafeMediaUrl,
  isPrivateOrLocalHostname,
} from "@/lib/media-url-safety";

/** Ensure `candidate` resolves inside `root` (defense in depth vs path traversal). */
export function assertPathInsideRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new Error("Path escapes storage root");
  }
  return resolved;
}
