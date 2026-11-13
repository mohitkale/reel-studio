import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { executeProductionJob } from "@/library/production-job-executor";
import { runProductionWorkerOnce } from "@/library/production-worker";
import {
  produceFromStoryboard,
  StoryboardLintError,
} from "@/library/storyboard-production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const flag = z
  .union([z.boolean(), z.enum(["1", "true", "0", "false"])])
  .transform((v) => v === true || v === "1" || v === "true");
const optionsSchema = z
  .object({
    quality: z.enum(["draft", "standard", "high"]).optional(),
    dryRun: flag.optional(),
    force: flag.optional(),
    createOnly: flag.optional(),
    minSeconds: z.coerce.number().positive().max(3600).optional(),
    maxSeconds: z.coerce.number().positive().max(3600).optional(),
  })
  .strict();

/**
 * POST /api/storyboards: storyboard in, queued production job out.
 *
 * Body: the storyboard, or `{ storyboard, quality?, dryRun?, force? }`. Options
 * may also be query parameters (`?dryRun=1&quality=draft`), so a storyboard file
 * can be posted as is. `dryRun` returns the resolved plan and creates nothing.
 * The same storyboard and options return the existing job unless `force` is set.
 * `createOnly` makes the editable project and returns without a job (editor import).
 */
export async function POST(req: Request) {
  try {
    const auth = authorizeRequest(req, "studio:write");
    const url = new URL(req.url);
    const body = await readRequestJson(req);
    const wrapped =
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      "storyboard" in body &&
      !("scenes" in body) &&
      !("turns" in body);
    const record = body as Record<string, unknown>;
    const fromQuery = Object.fromEntries(url.searchParams);
    const fromBody = wrapped
      ? Object.fromEntries(
          Object.entries(record).filter(([key]) => key !== "storyboard"),
        )
      : {};
    const options = parseClientInput(optionsSchema, {
      ...fromQuery,
      ...fromBody,
    });
    const result = await produceFromStoryboard(
      wrapped ? record.storyboard : body,
      {
        ...options,
        auth,
        serverBaseUrl: url.origin,
      },
    );
    if (result.dryRun) return NextResponse.json(result);
    if (result.state === "queued" && !result.reused && result.jobId) {
      after(() =>
        runProductionWorkerOnce({
          workerId: `web-storyboard:${randomUUID()}`,
          execute: executeProductionJob,
        }),
      );
    }
    return NextResponse.json(result, { status: result.reused ? 200 : 202 });
  } catch (error) {
    if (error instanceof StoryboardLintError) {
      return NextResponse.json(
        {
          error: error.message,
          ok: false,
          fixes: error.lint.fixes,
          warnings: error.lint.warnings,
          errors: error.lint.errors,
        },
        { status: 422 },
      );
    }
    return errorResponse(error);
  }
}
