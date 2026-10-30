import {
  readEditorialRecord,
  changeEditorialRecord,
} from "@/library/repositories/editorial";
import { after, NextResponse } from "next/server";
import {
  authorizeRequest,
  authorizeProviderRequest,
  authorizeRead,
} from "@/server/auth";
import {
  parseClientInput,
  readRequestJson,
  errorResponse,
} from "@/server/api-helpers";
import { editorialControlSchema } from "@/production/editorial";
import {
  runEditorialWriting,
  controlEditorialWriting,
} from "@/library/editorial-writing";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = await context.params;
    const input = parseClientInput(
      editorialControlSchema,
      await readRequestJson(req),
    );
    const workflow = await controlEditorialWriting(id, input);
    if (input.action === "resume" && workflow.state === "queued")
      after(async () => {
        await runEditorialWriting(id, (providerId) =>
          authorizeProviderRequest(req, [providerId]),
        );
      });
    return NextResponse.json({ workflow });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await context.params;
    const record = await readEditorialRecord(id);
    if (!record)
      return NextResponse.json(
        { error: "Editorial draft not found" },
        { status: 404 },
      );
    const workflow =
      ["queued", "running"].includes(record.workflow.state) &&
      Date.parse(record.workflow.deadlineAt) <= Date.now()
        ? await changeEditorialRecord(id, (current) =>
            ["queued", "running"].includes(current.state) &&
            Date.parse(current.deadlineAt) <= Date.now()
              ? {
                  ...current,
                  state: "failed",
                  error:
                    "Writing deadline expired. Inspect usage before a new explicit request; paid work is not replayed.",
                }
              : current,
          )
        : record.workflow;
    return NextResponse.json(
      { workflow, storyboard: record.storyboard },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
