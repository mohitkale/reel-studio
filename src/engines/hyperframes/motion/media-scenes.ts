import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import { buildCinematicBrandScene } from "@/engines/hyperframes/presets/cinematic-brand";
import { buildProductLaunchScene } from "@/engines/hyperframes/presets/product-launch";
import {
  isMediaMotionRecipe,
  resolveMotionDirection,
} from "@/production/motion";

export function buildMediaMotionScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
}): string | null {
  const { scene } = args;
  const motion = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  if (!motion || !isMediaMotionRecipe(motion.recipeId) || scene.hideText)
    return null;
  const device = motion.recipeId === "media-device";
  const directedScene: ReelScene = {
    ...scene,
    role: device ? "screenshot-demo" : "hero",
    templateId: "hf-opener",
  };
  let html = device
    ? buildProductLaunchScene({
        ...args,
        scene: directedScene,
        motionStiffness: "1",
      })
    : buildCinematicBrandScene({
        ...args,
        scene:
          scene.background?.type === "video"
            ? { ...directedScene, background: undefined }
            : directedScene,
        motionStiffness: "1",
      });
  if (html && scene.background?.type === "video") {
    const escape = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const video = `<video id="scene-${escape(scene.id)}-motion-video" class="motion-video${device ? "" : " cb-media"}" src="${escape(scene.background.url)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-media-start="0" data-track-index="0" muted playsinline preload="auto"></video>`;
    // The producer discovers timed media at any depth. Animate the enclosing
    // device/stage; the producer owns source-frame decoding and playback.
    html = device
      ? html.replace(/<video[^>]*><\/video>/, video)
      : html.replace(
          '<div class="cb-scrim">',
          `${video}<div class="cb-scrim">`,
        );
  }
  return (
    html
      ?.replace(
        "data-production-preset=",
        `data-motion-recipe="${motion.recipeId}" data-motion-version="${motion.version}" data-production-preset=`,
      )
      .replace(
        'class="clip scene preset-scene',
        `class="clip scene preset-scene ${motion.recipeId}`,
      ) ?? null
  );
}

export const MEDIA_MOTION_STYLES = `
  .media-device .pl-media img, .media-device .pl-media video { object-fit: contain; background: #080c14; }
  @media (min-aspect-ratio: 5/4) {
    .media-cinematic .cb-content.role-hero { padding-bottom: max(var(--safe-bottom, 10%), 19%); }
    .media-device .pl-content { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-content: center; text-align: left; }
    .media-device .pl-role-label { grid-column: 1 / -1; justify-self: start; }
    .media-device .pl-device { width: 100%; min-width: 0; }
    .media-device .pl-support { min-width: 0; margin: 0; }
  }
`;
