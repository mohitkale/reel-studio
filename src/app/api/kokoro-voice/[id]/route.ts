import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";

/**
 * Serves Kokoro voice style-vector files (`<id>.bin`) bundled inside the
 * `kokoro-js` package. The in-browser Kokoro worker otherwise lazy-fetches
 * these from HuggingFace's CDN, which some networks block — the worker rewrites
 * those requests to this same-origin route so every voice works offline.
 */

// Voice ids are like "af_heart", "bm_george": two letters, underscore, letters.
const VOICE_ID_RE = /^[a-z]{2}_[a-z]+$/;

/** Candidate `voices/` dirs — bundlers may resolve the package path differently. */
function voicesDirCandidates(): string[] {
  const dirs = [path.join(process.cwd(), "node_modules", "kokoro-js", "voices")];
  try {
    const require = createRequire(import.meta.url);
    dirs.push(path.join(path.dirname(require.resolve("kokoro-js")), "..", "voices"));
  } catch {
    // ignore — cwd candidate above is the reliable one in Next
  }
  return dirs;
}

async function readVoiceFile(id: string): Promise<Buffer | null> {
  for (const dir of voicesDirCandidates()) {
    const buf = await readFile(path.join(dir, `${id}.bin`)).catch(() => null);
    if (buf) return buf;
  }
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!VOICE_ID_RE.test(id)) {
      return new Response("Invalid voice id", { status: 400 });
    }
    const buf = await readVoiceFile(id);
    if (!buf) {
      return new Response("Voice not found", { status: 404 });
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        // Voice vectors are immutable for a given package version.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
