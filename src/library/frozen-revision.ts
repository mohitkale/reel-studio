import { filmPlanMatchesSource } from "@/production/film-plan";
import { videoRevisionHash } from "@/library/production-revision";
import type { VideoSnapshot } from "@/production/video-snapshot";
/** Historical revisions hashed in-memory undefined keys, which JSON omits.
 * Keep those readable through their canonical M1 source binding. New factory
 * children hash their serialized source and require both bindings to agree.
 */
export function frozenRevisionMatches(
  row: { revisionHash: string; source: string },
  snapshot: VideoSnapshot,
) {
  const bound = snapshot.filmPlan ? filmPlanMatchesSource(snapshot) : undefined;
  if (bound === false) return false;
  if (videoRevisionHash(snapshot) === row.revisionHash) return true;
  return row.source !== "factory" && bound === true;
}
