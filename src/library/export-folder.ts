import { promises as fs } from "node:fs";
import path from "node:path";

import { buildPublishingKit } from "@/lib/publishing-kit";
import { productionJobViewWithRevision } from "@/library/production-job-view";
import { projectToStoryboard } from "@/library/project-storyboard";
import { getProductionJob } from "@/library/repositories/production-jobs";
import { renderThumbnailPng } from "@/library/thumbnail";
import { ProviderError } from "@/providers/voice/types";
import { getTheme } from "@/video/themes";

export interface ExportFolder {
  /** Absolute path of the folder on this computer. */
  folder: string;
  files: string[];
  /** Thumbnail left out (it needs Chrome); everything else is still there. */
  notes: string[];
}

const slugOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "video";

/**
 * One folder per finished video with everything needed to post it: the MP4, the
 * title, description and hashtags, the storyboard and a thumbnail. It lives under
 * `media/exports/` so an agent or a person can open it as a unit. Safe to call
 * again: the same folder is refreshed.
 */
export async function writeExportFolder(jobId: string): Promise<ExportFolder> {
  const job = await getProductionJob(jobId);
  if (!job) throw new ProviderError("Production job not found", 404);
  if (job.state !== "succeeded")
    throw new ProviderError("The video is not finished yet.", 409);
  const view = await productionJobViewWithRevision(job);
  const scriptId = view.revision?.scriptId;
  const result = scriptId ? await projectToStoryboard(scriptId) : null;
  if (!result?.storyboard)
    throw new ProviderError("This video has no storyboard", 404);
  const storyboard = result.storyboard;

  const mediaRoot = path.resolve(process.cwd(), "media");
  const folder = path.join(
    mediaRoot,
    "exports",
    `${slugOf(storyboard.title)}-${jobId.slice(-8)}`,
  );
  await fs.mkdir(folder, { recursive: true });
  const files: string[] = [];
  const notes: string[] = [];
  const write = async (name: string, data: string | Buffer) => {
    await fs.writeFile(path.join(folder, name), data);
    files.push(name);
  };

  const kit = buildPublishingKit({
    title: storyboard.title,
    publish: storyboard.publish,
    scenes:
      storyboard.kind === "video"
        ? storyboard.scenes
        : storyboard.turns.map((t) => ({ narration: t.text })),
    sources: storyboard.sources,
  });
  await write("title.txt", `${kit.title}\n`);
  await write("description.txt", `${kit.description}\n`);
  await write("hashtags.txt", `${kit.hashtagLine}\n`);
  await write("storyboard.json", `${JSON.stringify(storyboard, null, 2)}\n`);

  const mp4 = job.outputs.find((output) => output.format === "mp4");
  const source = mp4
    ? path.isAbsolute(mp4.path)
      ? mp4.path
      : path.join(mediaRoot, mp4.path)
    : undefined;
  if (source && !path.relative(mediaRoot, source).startsWith("..")) {
    const target = path.join(folder, "video.mp4");
    // A repeat call does not copy a large file again.
    const same = await Promise.all([
      fs.stat(source),
      fs.stat(target).catch(() => null),
    ]).then(([a, b]) => b !== null && a.size === b.size);
    if (!same) await fs.copyFile(source, target);
    files.push("video.mp4");
  } else
    notes.push(
      "The video file is not under the media folder, so it was not copied.",
    );

  try {
    const theme = getTheme(
      "theme" in storyboard
        ? (storyboard.theme as string | undefined)
        : undefined,
    );
    const png = await renderThumbnailPng({
      text: kit.thumbnailText,
      size: "landscape",
      palette: theme?.palette,
      fontFamily: theme?.fonts.heading,
      videoPath:
        source && !path.relative(mediaRoot, source).startsWith("..")
          ? source
          : undefined,
    });
    await write("thumbnail-1280x720.png", Buffer.from(png));
  } catch {
    notes.push("The thumbnail was left out (it needs Chrome).");
  }
  return { folder, files, notes };
}
