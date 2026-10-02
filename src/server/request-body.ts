import { abortable } from "@/lib/deadline-fetch";

export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export const DEFAULT_JSON_BYTES = 4 * 1024 * 1024;
export const AUDIO_UPLOAD_BYTES = 96 * 1024 * 1024;

/** Count actual streamed bytes: Content-Length is only an early rejection hint. */
export async function readBoundedBody(
  req: Request,
  maxBytes: number,
  timeoutMs = 30_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = req.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))
  ) {
    void req.body?.cancel().catch(() => {});
    throw new RequestBodyError("Invalid Content-Length", 400);
  }
  if (declared !== null && Number(declared) > maxBytes) {
    void req.body?.cancel().catch(() => {});
    throw new RequestBodyError(`Request body exceeds ${maxBytes} bytes`, 413);
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const deadline = new AbortController();
  const timer = setTimeout(
    () => deadline.abort(new RequestBodyError("Request body timed out", 408)),
    timeoutMs,
  );
  const signal = AbortSignal.any([req.signal, deadline.signal]);
  const chunks: Uint8Array[] = [];
  let total = 0;
  let complete = false;
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) {
        complete = true;
        break;
      }
      total += chunk.value.byteLength;
      if (total > maxBytes)
        throw new RequestBodyError(
          `Request body exceeds ${maxBytes} bytes`,
          413,
        );
      chunks.push(chunk.value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } finally {
    clearTimeout(timer);
    if (complete) reader.releaseLock();
    else void reader.cancel().catch(() => {});
  }
}

export async function readBoundedFormData(
  req: Request,
  maxBytes: number,
): Promise<FormData> {
  const bytes = await readBoundedBody(req, maxBytes);
  try {
    return await new Response(bytes, {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new RequestBodyError("Invalid multipart form data", 400);
  }
}
