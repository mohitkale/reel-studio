import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, authorizeRead } from "@/server/auth";
import { errorResponse, parseClientInput } from "@/server/api-helpers";
import { readBoundedFormData } from "@/server/request-body";
import {
  importRecording,
  listRecordings,
  recordingReadiness,
} from "@/library/recording-repurpose";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 1024 ** 3;

/** GET /api/recordings: imported recordings and whether local transcription is ready. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return NextResponse.json({
      readiness: await recordingReadiness(),
      recordings: await listRecordings(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const pathBody = z
  .object({
    path: z.string().trim().min(1).max(4096),
    language: z.string().trim().max(12).optional(),
  })
  .strict();

/**
 * POST /api/recordings: import an audio or video file and transcribe it on this
 * computer. The web app uploads the file (multipart `file`); an agent with a
 * token passes `{ path }` to a file on this machine. Returns at once; poll
 * GET /api/recordings/:id until it is ready.
 */
export async function POST(req: Request) {
  try {
    const origin = authorize(req);
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      if (origin !== "mcp")
        throw new ProviderError(
          "Only an agent with a token can import by path. Upload the file instead.",
          403,
        );
      const body = parseClientInput(pathBody, await req.json());
      return NextResponse.json(
        await importRecording({
          name: body.path,
          sourcePath: body.path,
          language: body.language,
        }),
        { status: 202 },
      );
    }
    const form = await readBoundedFormData(req, MAX_UPLOAD_BYTES + 512 * 1024);
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ProviderError("Choose a file to import.", 400);
    if (file.size > MAX_UPLOAD_BYTES)
      throw new ProviderError("That file is larger than 1 GB.", 413);
    const language = form.get("language");
    return NextResponse.json(
      await importRecording({
        name: file.name,
        bytes: Buffer.from(await file.arrayBuffer()),
        language: typeof language === "string" ? language : undefined,
      }),
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
