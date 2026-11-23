import { z } from "zod";

export const renderSectionSchema = z
  .object({
    index: z.number().int().min(0),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(0), // inclusive, matching native render APIs
  })
  .strict()
  .refine((section) => section.endFrame >= section.startFrame);
export type RenderSection = z.infer<typeof renderSectionSchema>;
export const DEFAULT_RENDER_SECTION_SECONDS = 30;
export const SHORT_RENDER_SECTION_SECONDS = 5;
export const MAX_RENDER_SECTION_COUNT = 20;

/** Keep global timestamps, partitioning bounded capture work without retiming. */
export function planRenderSections(
  totalFrames: number,
  fps: number,
  chapterStarts: number[] = [],
  sectionSeconds = DEFAULT_RENDER_SECTION_SECONDS,
) {
  if (
    !Number.isInteger(totalFrames) ||
    totalFrames < 1 ||
    !Number.isInteger(fps) ||
    fps < 1 ||
    fps > 60 ||
    !Number.isInteger(sectionSeconds) ||
    sectionSeconds < 1 ||
    sectionSeconds > DEFAULT_RENDER_SECTION_SECONDS ||
    totalFrames > fps * 600
  )
    throw new Error(
      "Section rendering supports up to ten minutes at 1–60 fps.",
    );
  const boundaries = [
    ...new Set([
      0,
      ...chapterStarts.filter(
        (frame) => Number.isInteger(frame) && frame > 0 && frame < totalFrames,
      ),
      totalFrames,
    ]),
  ].sort((a, b) => a - b);
  const sectionFrames = fps * sectionSeconds;
  const sections: RenderSection[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    for (
      let start = boundaries[index];
      start < boundaries[index + 1];
      start += sectionFrames
    )
      sections.push({
        index: sections.length,
        startFrame: start,
        endFrame: Math.min(boundaries[index + 1], start + sectionFrames) - 1,
      });
  }
  return sections;
}
