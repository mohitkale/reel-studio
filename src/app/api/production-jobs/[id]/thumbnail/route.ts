import { mediaDirectory } from "@/library/storage/media-directory";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeRequest } from "@/server/auth";
import { errorResponse, parseClientInput } from "@/server/api-helpers";
import { productionJobViewWithRevision } from "@/library/production-job-view";
import { projectToStoryboard } from "@/library/project-storyboard";
import { getProductionJob } from "@/library/repositories/production-jobs";
import { renderThumbnailPng } from "@/library/thumbnail";
import { getTheme } from "@/video/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    size: z.enum(["landscape", "vertical"]).default("landscape"),
    download: z.string().optional(),
  })
  .strict();

/**
 * GET /api/production-jobs/:id/thumbnail?size=landscape|vertical: a PNG
 * thumbnail (1280x720 or 1080x1920) with the storyboard's thumbnail text over a
 * frame of the finished video, in the theme's colours.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "artifacts:read");
    const { id } = await context.params;
    const query = parseClientInput(
      querySchema,
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const job = await getProductionJob(id);
    if (!job)
      return NextResponse.json(
        { error: "Production job not found" },
        { status: 404 },
      );
    const view = await productionJobViewWithRevision(job);
    const scriptId = view.revision?.scriptId;
    if (!scriptId)
      return NextResponse.json(
        { error: "This video has no storyboard" },
        { status: 404 },
      );
    const result = await projectToStoryboard(scriptId);
    if (!result?.storyboard)
      return NextResponse.json(
        { error: "No storyboard for this video" },
        { status: 404 },
      );
    const storyboard = result.storyboard;
    const text = storyboard.publish?.thumbnailText ?? storyboard.title;
    const theme = getTheme(
      "theme" in storyboard
        ? (storyboard.theme as string | undefined)
        : undefined,
    );

    // The finished video, only when it lives under the media folder.
    const mp4 = job.outputs.find((output) => output.format === "mp4");
    const mediaRoot = mediaDirectory();
    const candidate = mp4
      ? path.isAbsolute(mp4.path)
        ? mp4.path
        : path.join(mediaRoot, mp4.path)
      : undefined;
    const videoPath =
      candidate && !path.relative(mediaRoot, candidate).startsWith("..")
        ? candidate
        : undefined;

    const png = await renderThumbnailPng({
      text,
      size: query.size,
      palette: theme?.palette,
      fontFamily: theme?.fonts.heading,
      videoPath,
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
        ...(query.download
          ? {
              "content-disposition": `attachment; filename="thumbnail-${query.size}.png"`,
            }
          : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
