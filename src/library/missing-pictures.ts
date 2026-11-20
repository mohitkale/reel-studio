import type { AutomaticMediaDecision } from "@/library/automatic-stock-media";
import type { LintWarning } from "@/storyboard/lint";

/** Rule name that marks a scene whose picture did not resolve (#245). */
export const MISSING_PICTURE_RULE = "media-unresolved";

interface SceneLike {
  type?: string;
  headline?: string;
  media?: {
    query?: string;
    assetId?: string;
    path?: string;
    generate?: string;
  };
}

/** Why a stock search ended without a picture, in plain words. */
export function missingPictureReason(
  decision: AutomaticMediaDecision | undefined,
  query: string | undefined,
): string {
  switch (decision?.state) {
    case "no-provider":
      return "no picture source is set up that can be used without asking you (add a Pexels or Pixabay key in Settings; Unsplash pictures can only be picked by hand), or give the scene an assetId of a picture in the library";
    case "no-result":
      return decision.failedProviders?.length
        ? `${decision.failedProviders.join(" and ")} refused or failed the search for "${query ?? "the headline"}"; try again, or give the scene an assetId`
        : `no stock result for "${query ?? "the headline"}"; try different words, or give the scene an assetId`;
    case "no-intent":
      return "the scene gave nothing to search for; add media.query";
    default:
      return decision?.message ?? "no picture was found";
  }
}

/**
 * One warning per scene that asked for a picture (type media or media-split) and
 * did not get one. The scene is then drawn as a plain statement, so the warning
 * says so.
 */
export function missingPictureWarnings(
  storyboard: { kind?: string; scenes?: SceneLike[] },
  decisions: Array<AutomaticMediaDecision | undefined>,
  hasPicture: boolean[],
): LintWarning[] {
  if (storyboard.kind && storyboard.kind !== "video") return [];
  const out: LintWarning[] = [];
  (storyboard.scenes ?? []).forEach((scene, index) => {
    const asked = scene.type === "media" || scene.type === "media-split";
    if (!asked || hasPicture[index]) return;
    const reason = missingPictureReason(
      decisions[index],
      scene.media?.query ?? scene.headline,
    );
    out.push({
      path: `scenes.${index}.media`,
      rule: MISSING_PICTURE_RULE,
      message: `Scene ${index + 1} (${scene.type}) has no picture: ${reason}. It is shown as a statement.`,
    });
  });
  return out;
}
