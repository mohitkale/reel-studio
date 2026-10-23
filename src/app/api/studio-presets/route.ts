import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  readRequestJson,
  parseClientInput,
} from "@/server/api-helpers";
import { studioPresetInputSchema } from "@/lib/studio-preset";
import {
  listStudioPresets,
  saveStudioPreset,
} from "@/library/repositories/studio-presets";
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return Response.json({ presets: await listStudioPresets() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const input = parseClientInput(
      studioPresetInputSchema,
      await readRequestJson(req),
    );
    return Response.json(await saveStudioPreset(input));
  } catch (e) {
    return errorResponse(e);
  }
}
