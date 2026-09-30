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

/** Keep global timestamps, partitioning bounded capture work without retiming. */
export function planRenderSections(
  totalFrames: number,
  fps: number,
  chapterStarts: number[] = [],
) {
  if (
    !Number.isInteger(totalFrames) ||
    totalFrames < 1 ||
    !Number.isInteger(fps) ||
    fps < 1 ||
    fps > 60 ||
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
  const sections: RenderSection[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    for (
      let start = boundaries[index];
      start < boundaries[index + 1];
      start += fps * 30
    )
      sections.push({
        index: sections.length,
        startFrame: start,
        endFrame: Math.min(boundaries[index + 1], start + fps * 30) - 1,
      });
  }
  return sections;
}
