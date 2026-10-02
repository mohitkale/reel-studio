import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReelProps } from "@/video/types";
import {
  buildHyperframesCompositionHtml,
  compositionTotalFrames,
} from "@/engines/hyperframes/build-composition";
import { getCatalogBlockByTemplateId } from "@/engines/hyperframes/catalog/manifest";
import { sectionVisualProps } from "@/production/section-visuals";
import { planRenderSections } from "@/production/render-sections";

/** Freeze actual silent native projects, never a guessed projection of a
 * compiled page. Imported sub-compositions may reach outside their scene and
 * retain whole-composition invalidation until their dependencies are proven.
 */
export async function writeHyperframesVisualSections(
  projectDir: string,
  props: ReelProps,
) {
  const root = path.join(`${projectDir}-sections`, "visuals");
  if (
    props.scenes.some((scene) =>
      getCatalogBlockByTemplateId(scene.templateId, props.catalogRevision),
    )
  )
    return false;
  const fps = props.fps || 30;
  const totalFrames = compositionTotalFrames(props);
  for (const section of planRenderSections(totalFrames, fps)) {
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
    const html = buildHyperframesCompositionHtml(scoped, {
      producerMode: true,
      runtimeUrl: "/_runtime/gsap.min.js",
      totalFrames,
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
      count: planRenderSections(totalFrames, fps).length,
    }),
  );
  return true;
}
