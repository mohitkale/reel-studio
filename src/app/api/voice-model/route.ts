import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  downloadVoiceModel,
  getVoiceModelStatus,
  KOKORO_APPROX_BYTES,
  type DownloadProgress,
} from "@/library/voice-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Job =
  | { state: "idle" }
  | { state: "downloading"; progress?: DownloadProgress }
  | { state: "done" }
  | { state: "error"; message: string };

let job: Job = { state: "idle" };

const bodySchema = z.object({ confirm: z.literal(true) }).strict();

/**
 * GET /api/voice-model — whether the local voice model is on this machine, where
 * it lives, how big the download is, and the progress of a running download.
 */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    const status = await getVoiceModelStatus();
    return NextResponse.json({
      ...status,
      approxBytes: KOKORO_APPROX_BYTES,
      job,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/voice-model `{ "confirm": true }` — download the model. It needs the
 * explicit confirmation because it fetches about 90 MB from the model host.
 * Interrupted downloads resume; declining simply means never calling this.
 */
export async function POST(req: Request) {
  try {
    authorize(req);
    parseClientInput(bodySchema, await readRequestJson(req));
    if (job.state !== "downloading") {
      job = { state: "downloading" };
      void downloadVoiceModel({
        onProgress: (progress) => {
          job = { state: "downloading", progress };
        },
      })
        .then(() => {
          job = { state: "done" };
        })
        .catch((error: unknown) => {
          job = {
            state: "error",
            message: error instanceof Error ? error.message : String(error),
          };
        });
    }
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
