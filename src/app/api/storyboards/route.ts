import { applySeries, findSeries } from "@/lib/series";
import { getConfig } from "@/server/app-config";
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
    /** Wait for approval before making the video (the "review before making" setting). */
    review: flag.optional(),
    /** Name of a saved series; it fills in what the storyboard leaves out. */
    series: z.string().trim().min(1).max(40).optional(),
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
    const { series: seriesName, ...productionOptions } = options;
    let source: unknown = wrapped ? record.storyboard : body;
    let brandKitId: string | undefined;
    if (seriesName) {
      const found = findSeries((await getConfig()).series, seriesName);
      if (!found)
        return NextResponse.json(
          {
            error: `There is no series called "${seriesName}". See GET /api/series.`,
          },
          { status: 404 },
        );
      if (source && typeof source === "object" && !Array.isArray(source))
        source = applySeries(source as Record<string, unknown>, found);
      if (found.brandKitId) brandKitId = found.brandKitId;
    }
    const result = await produceFromStoryboard(source, {
      ...productionOptions,
      brandKitId,
      auth,
      serverBaseUrl: url.origin,
    });
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
