import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReelProps } from "@/video/types";
import type { Accent, Blink, MouthKey } from "@/video/visemes";

type PresenterTrackInput = {
  mouth: MouthKey[];
  blinks: Blink[];
  accents?: Accent[];
};
import {
  buildHyperframesCompositionHtml,
  compositionTotalFrames,
} from "@/engines/hyperframes/build-composition";
import { getCatalogBlockByTemplateId } from "@/engines/hyperframes/catalog/manifest";
import { sectionVisualProps } from "@/production/section-visuals";
import {
  DEFAULT_RENDER_SECTION_SECONDS,
  planRenderSections,
  SHORT_RENDER_SECTION_SECONDS,
} from "@/production/render-sections";

export function supportsHyperframesVisualSections(props: ReelProps) {
  return !props.scenes.some((scene) =>
    getCatalogBlockByTemplateId(scene.templateId, props.catalogRevision),
  );
}

/** Freeze actual silent native projects, never a guessed projection of a
 * compiled page. Imported sub-compositions may reach outside their scene and
 * retain whole-composition invalidation until their dependencies are proven.
 */
export async function writeHyperframesVisualSections(
  projectDir: string,
  props: ReelProps,
  /** The presenter's mouth and blinks, when the video has one (global times). */
  presenterTrack?: PresenterTrackInput,
  options: { sectionSeconds?: number; draftScale?: number } = {},
) {
  const { sectionSeconds = DEFAULT_RENDER_SECTION_SECONDS, draftScale } =
    options;
  const root = path.join(`${projectDir}-sections`, "visuals");
  if (!supportsHyperframesVisualSections(props)) return false;
  const fps = props.fps || 30;
  const totalFrames = compositionTotalFrames(props);
  const sections = planRenderSections(totalFrames, fps, [], sectionSeconds);
  const short = sectionSeconds === SHORT_RENDER_SECTION_SECONDS;
  for (const section of sections) {
    const directory = path.join(root, String(section.index));
    await fs.mkdir(directory, { recursive: true });
    const scoped = sectionVisualProps(props, section, fps);
    const urls = [
      scoped.coverUrl,
      ...scoped.scenes.flatMap((scene) => [
        scene.background?.url,
        ...(scene.carouselImages ?? []),
      ]),
    ];
    for (const url of new Set(
      urls.filter((url): url is string => Boolean(url)),
    )) {
      if (!url.startsWith("_assets/")) continue;
      if (!/^_assets\/[a-zA-Z0-9._-]+$/.test(url))
        throw new Error("Unsafe scoped visual asset path.");
      await fs.mkdir(path.join(directory, "_assets"), { recursive: true });
      await fs.copyFile(path.join(projectDir, url), path.join(directory, url));
    }
    await fs.cp(
      path.join(projectDir, "_runtime"),
      path.join(directory, "_runtime"),
      { recursive: true },
    );
    const visualProps = short
      ? { ...props, audioUrl: undefined, musicUrl: undefined, sfxCues: [] }
      : scoped;
    const html = buildHyperframesCompositionHtml(visualProps, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
      totalFrames,
      presenterTrack,
      draftScale,
      stablePaint: short,
      section: short
        ? {
            ...section,
            sceneIds: new Set(scoped.scenes.map((scene) => scene.id)),
          }
        : undefined,
    });
    if (html.includes("data-composition-src="))
      throw new Error("Imported compositions cannot use scoped visual reuse.");
    await fs.writeFile(path.join(directory, "index.html"), html);
  }
  await fs.writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({
      version: 1,
      totalFrames,
      fps,
      count: sections.length,
      sectionSeconds,
    }),
  );
  return true;
}
