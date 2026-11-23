import { mediaDirectory } from "@/library/storage/media-directory";
import { constants, promises as fs } from "node:fs";
import path from "node:path";

import { buildCaptions, type CaptionCue } from "@/lib/captions";
import { buildPublishingKit } from "@/lib/publishing-kit";
import { getProductionJob } from "@/library/repositories/production-jobs";
import {
  projectToStoryboard,
  publishingStoryboard,
} from "@/library/project-storyboard";
import { getScript } from "@/library/repositories/scripts";
import { renderThumbnailPngs } from "@/library/thumbnail";
import { ProviderError } from "@/providers/voice/types";
import type { Storyboard } from "@/storyboard";
import { getTheme } from "@/video/themes";
import { coverFrames, type ReelProps } from "@/video/types";

export interface ExportFolder {
  /** Absolute path of the folder on this computer. */
  folder: string;
  files: string[];
  /** Missing files in packages reconstructed for older jobs. */
  notes: string[];
}

type PublishingMedia = Pick<
  ReelProps,
  "fps" | "timeline" | "captions" | "coverUrl"
>;
type PublishingScript = Parameters<typeof publishingStoryboard>[0] & {
  id: string;
};

const THUMBNAILS = ["thumbnail-1280x720.png", "thumbnail-1080x1920.png"];
const FILES = [
  "title.txt",
  "description.txt",
  "hashtags.txt",
  "storyboard.json",
  "captions.srt",
  "captions.vtt",
  "video.mp4",
  ...THUMBNAILS,
];

function automaticFolder(source: string): string {
  return path.resolve(mediaDirectory(), "exports", path.parse(source).name);
}

async function hasCompletePackage(folder: string): Promise<boolean> {
  const files: string[] = await fs.readdir(folder).catch(() => []);
  return FILES.every((name) => files.includes(name));
}

async function writePackage(input: {
  folder: string;
  storyboard: Storyboard;
  source?: string;
  media: PublishingMedia;
  sceneIds: string[];
  themeId?: string;
  legacy?: boolean;
}): Promise<ExportFolder> {
  const { folder, storyboard, source, media } = input;
  const files: string[] = [];
  const notes: string[] = [];
  const write = async (name: string, data: string | Buffer) => {
    await fs.writeFile(path.join(folder, name), data);
    files.push(name);
  };
  const fps = media.fps || 30;
  const cover = coverFrames(fps, Boolean(media.coverUrl));
  const starts = new Map(
    media.timeline.map((beat) => [beat.sceneId, beat.startFrame]),
  );
  const chapters =
    storyboard.kind === "video"
      ? storyboard.chapters?.flatMap((chapter) => {
          const at = starts.get(input.sceneIds[chapter.startScene] || "");
          if (at === undefined) return [];
          return [
            {
              title: chapter.title,
              startSeconds: at === 0 ? 0 : (cover + at) / fps,
            },
          ];
        })
      : undefined;
  const kit = buildPublishingKit({
    title: storyboard.title,
    publish: storyboard.publish,
    scenes:
      storyboard.kind === "video"
        ? storyboard.scenes
        : storyboard.turns.map((turn) => ({ narration: turn.text })),
    sources: storyboard.sources,
    chapters,
  });
  await write("title.txt", `${kit.title}\n`);
  await write("description.txt", `${kit.description}\n`);
  await write("hashtags.txt", `${kit.hashtagLine}\n`);
  await write("storyboard.json", `${JSON.stringify(storyboard, null, 2)}\n`);
  const cues: CaptionCue[] = media.captions?.enabled
    ? media.captions.cues.map((cue) => ({
        startFrame: cover + cue.startFrame,
        endFrame: cover + cue.endFrame,
        text: cue.text,
      }))
    : [];
  await write("captions.srt", buildCaptions(cues, fps, "srt"));
  await write("captions.vtt", buildCaptions(cues, fps, "vtt"));

  if (source) {
    const target = path.join(folder, "video.mp4");
    const same =
      input.legacy &&
      (await Promise.all([
        fs.stat(source),
        fs.stat(target).catch(() => null),
      ]).then(([a, b]) => b?.size === a.size));
    if (!same) await fs.copyFile(source, target, constants.COPYFILE_FICLONE);
    files.push("video.mp4");
  } else {
    notes.push(
      "The video file is not under the media folder, so it was not copied.",
    );
  }

  const theme = getTheme(
    input.themeId ??
      (storyboard.kind === "video" ? storyboard.theme : undefined),
  );
  try {
    const pngs = await renderThumbnailPngs(
      {
        text: kit.thumbnailText,
        palette: theme?.palette,
        fontFamily: theme?.fonts.heading,
        videoPath: source,
      },
      ["landscape", "vertical"],
    );
    for (const [index, png] of pngs.entries())
      await write(THUMBNAILS[index]!, png);
  } catch (error) {
    if (!input.legacy) throw error;
    notes.push("The thumbnails were left out (they need Chrome).");
  }
  return { folder, files, notes };
}

/** Publish a complete package alongside each newly rendered video. */
export async function writeRenderExportFolder(
  source: string,
  script: PublishingScript,
  media: PublishingMedia,
  themeId?: string,
): Promise<ExportFolder> {
  const folder = automaticFolder(source);
  if (await hasCompletePackage(folder))
    return { folder, files: FILES, notes: [] };
  const root = path.dirname(folder);
  await fs.mkdir(root, { recursive: true });
  const staging = await fs.mkdtemp(path.join(root, ".publishing-"));
  try {
    const result = await projectToStoryboard(script.id, script);
    const output = await writePackage({
      folder: staging,
      storyboard: publishingStoryboard(script, result),
      source,
      media,
      sceneIds: script.scenes.map((scene) => scene.id),
      themeId,
    });
    try {
      await fs.rename(staging, folder);
    } catch (error) {
      if (!(await hasCompletePackage(folder))) throw error;
    }
    return { ...output, folder };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

/** Return the render's package, or reconstruct it on demand for an older job. */
export async function writeExportFolder(jobId: string): Promise<ExportFolder> {
  const job = await getProductionJob(jobId);
  if (!job) throw new ProviderError("Production job not found", 404);
  if (job.state !== "succeeded")
    throw new ProviderError("The video is not finished yet.", 409);

  const mediaRoot = mediaDirectory();
  const mp4 = job.outputs.find((output) => output.format === "mp4");
  const candidate = mp4 && path.resolve(mediaRoot, mp4.path);
  const source =
    candidate && !path.relative(mediaRoot, candidate).startsWith("..")
      ? candidate
      : undefined;
  if (source) {
    const folder = automaticFolder(source);
    if (await hasCompletePackage(folder))
      return { folder, files: FILES, notes: [] };
  }

  const scriptId = job.productionRevision?.scriptId;
  const script = scriptId ? await getScript(scriptId) : null;
  if (!script) throw new ProviderError("This video has no storyboard", 404);
  const storyboard = publishingStoryboard(
    script,
    await projectToStoryboard(script.id, script),
  );
  const slug =
    storyboard.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "video";
  const folder = path.join(mediaRoot, "exports", `${slug}-${jobId.slice(-8)}`);
  await fs.mkdir(folder, { recursive: true });
  const take = script.takes[0];
  return writePackage({
    folder,
    storyboard,
    source,
    legacy: true,
    sceneIds: script.scenes.map((scene) => scene.id),
    media: {
      fps: take?.fps ?? script.fps,
      timeline: take?.timeline ?? [],
      coverUrl: script.coverUrl ?? undefined,
      captions: script.captionTracks?.find((track) => track.enabled),
    },
  });
}
