import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  editorialCreationRequestSchema,
  editorialControlSchema,
} from "@/production/editorial";
import { storyboardControlSchema } from "@/production/editorial-storyboard";
import { editorialReviewControlSchema } from "@/production/editorial-review";
import { apiGet, apiPost, encode } from "./client.js";
const id = z.string().min(1).max(160);
function result(work: () => Promise<unknown>) {
  return work()
    .then((data) => ({
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }))
    .catch((error: unknown) => ({
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Error: ${error instanceof Error ? error.message : "Editorial operation failed"}`,
        },
      ],
    }));
}
/** REST owns all claims, quotas, locks and stale-state guards. */
export function registerEditorialTools(server: McpServer) {
  server.registerTool(
    "create_editorial_project",
    {
      description:
        "Save a source-linked writing stage before layouts. Explicit idempotency key, creative brief and total call budget; no automatic paid replay.",
      inputSchema: editorialCreationRequestSchema.shape,
    },
    (input) => result(() => apiPost("/api/projects/editorial", input)),
  );
  server.registerTool(
    "get_editorial_script",
    {
      description: "Read durable writing state, usage and cached storyboard.",
      inputSchema: { scriptId: id },
    },
    ({ scriptId }) =>
      result(() => apiGet(`/api/scripts/${encode(scriptId)}/editorial`)),
  );
  server.registerTool(
    "control_editorial_script",
    {
      description:
        "Save writing with expected revision, cancel, or resume only unspent work.",
      inputSchema: { scriptId: id, control: editorialControlSchema },
    },
    ({ scriptId, control }) =>
      result(() =>
        apiPost(`/api/scripts/${encode(scriptId)}/editorial`, control),
      ),
  );
  server.registerTool(
    "control_editorial_storyboard",
    {
      description:
        "Compile at zero provider calls, cancel a preview, or apply its exact source hash. Review shots before apply.",
      inputSchema: { scriptId: id, control: storyboardControlSchema },
    },
    ({ scriptId, control }) =>
      result(() =>
        apiPost(
          `/api/scripts/${encode(scriptId)}/editorial/storyboard`,
          control,
        ),
      ),
  );
  server.registerTool(
    "get_editorial_review",
    {
      description:
        "Read heuristic findings, current source hash and scoped revision proposal; no model call.",
      inputSchema: { scriptId: id },
    },
    ({ scriptId }) =>
      result(() => apiGet(`/api/scripts/${encode(scriptId)}/editorial/review`)),
  );
  server.registerTool(
    "control_editorial_revision",
    {
      description:
        "Preview make-specific, shorten, replace-visual or keep-copy/change-direction; then guarded apply, cancel or undo. Visual work is local. AI copy reserves one explicit call from the saved total budget.",
      inputSchema: { scriptId: id, control: editorialReviewControlSchema },
    },
    ({ scriptId, control }) =>
      result(() =>
        apiPost(`/api/scripts/${encode(scriptId)}/editorial/review`, control),
      ),
  );
}
