import { abortable } from "@/lib/deadline-fetch";
import { ResearchProviderError } from "./types";

export async function readResearchJson(
  response: Response,
  signal: AbortSignal,
  provider = "Gemini",
): Promise<unknown> {
  const maximum = 1_000_000;
  if (Number(response.headers.get("content-length")) > maximum) {
    await response.body?.cancel();
    throw new ResearchProviderError(
      `${provider} research response exceeded its size limit`,
    );
  }
  if (!response.body)
    throw new ResearchProviderError(`${provider} returned an empty response`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) {
        complete = true;
        break;
      }
      size += chunk.value.byteLength;
      if (size > maximum)
        throw new ResearchProviderError(
          `${provider} research response exceeded its size limit`,
        );
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    if (complete) reader.releaseLock();
    else void reader.cancel().catch(() => {});
  }
}
