import { assertRenderStagingAllowed } from "@/lib/render-media-policy";
import { mediaSignatureMatches } from "@/lib/media-signature";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { open, rm } from "node:fs/promises";
import { z } from "zod";
import { abortable } from "@/lib/deadline-fetch";
import {
  assertPublicArticleUrl,
  createPublicLookup,
  defaultResolveHost,
} from "@/production/source-ingestion";

const mediaFormats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
};
type ResolveHost = typeof defaultResolveHost;
type RequestMedia = (
  url: URL,
  options: {
    lookup: ReturnType<typeof createPublicLookup>;
    signal: AbortSignal;
  },
) => Promise<IncomingMessage>;
const requestMedia: RequestMedia = (url, { lookup, signal }) =>
  new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        lookup,
        signal,
        headers: {
          "Accept-Encoding": "identity",
          Accept: "image/*,video/*,audio/*",
          "User-Agent": "Reel-Studio media",
        },
      },
      resolve,
    );
    request.on("error", reject);
  });

/** DNS is checked again inside the socket lookup and the exact checked answers
 * are returned to Node. Redirect bodies are never rendered. No browser fetches. */
export async function downloadPublicMediaToFile(
  value: string,
  destination: string,
  options: {
    signal?: AbortSignal;
    maxBytes?: number;
    timeoutMs?: number;
    resolveHost?: ResolveHost;
    request?: RequestMedia;
  } = {},
) {
  const maxBytes = z
    .number()
    .int()
    .positive()
    .max(250 * 1024 * 1024)
    .parse(options.maxBytes ?? 250 * 1024 * 1024);
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const deadline = new AbortController();
  const timer = setTimeout(
    () =>
      deadline.abort(
        new DOMException("Media download timed out", "TimeoutError"),
      ),
    options.timeoutMs ?? 60_000,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline.signal])
    : deadline.signal;
  let incoming: IncomingMessage | undefined;
  let created = false;
  try {
    signal.throwIfAborted();
    assertRenderStagingAllowed(value);
    let url = await abortable(
      assertPublicArticleUrl(value, resolveHost),
      signal,
    );
    for (let redirects = 0; ; redirects++) {
      incoming = await abortable(
        (options.request ?? requestMedia)(url, {
          lookup: createPublicLookup(resolveHost),
          signal,
        }),
        signal,
      );
      if ([301, 302, 303, 307, 308].includes(incoming.statusCode ?? 0)) {
        const location = incoming.headers.location;
        incoming.destroy();
        if (!location || redirects >= 4)
          throw new Error("Media redirect limit exceeded");
        const next = new URL(location, url).href;
        assertRenderStagingAllowed(next);
        url = await abortable(
          assertPublicArticleUrl(next, resolveHost),
          signal,
        );
        continue;
      }
      if ((incoming.statusCode ?? 0) < 200 || (incoming.statusCode ?? 0) >= 300)
        throw new Error(`Media download failed (HTTP ${incoming.statusCode})`);
      if (
        incoming.headers["content-encoding"] &&
        incoming.headers["content-encoding"] !== "identity"
      )
        throw new Error("Encoded media responses are not supported");
      const mime =
        incoming.headers["content-type"]
          ?.split(";", 1)[0]
          .trim()
          .toLowerCase() ?? "";
      const extension = mediaFormats[mime];
      if (!extension)
        throw new Error(
          "Remote media must be a supported image, video or audio type",
        );
      const declared = incoming.headers["content-length"];
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
        throw new Error("Remote media exceeds its byte limit");
      const file = await open(destination, "wx");
      created = true;
      let bytes = 0;
      let prefix = Buffer.alloc(0);
      try {
        const iterator = incoming[Symbol.asyncIterator]();
        while (true) {
          const part = await abortable(iterator.next(), signal);
          if (part.done) break;
          const chunk: Buffer = part.value;
          bytes += chunk.byteLength;
          if (prefix.length < 32)
            prefix = Buffer.concat([
              prefix,
              chunk.subarray(0, 32 - prefix.length),
            ]);
          if (bytes > maxBytes)
            throw new Error("Remote media exceeds its byte limit");
          signal.throwIfAborted();
          await file.writeFile(chunk);
        }
        if (!bytes) throw new Error("Remote media is empty");
        if (!mediaSignatureMatches(prefix, mime))
          throw new Error("Remote media signature does not match its type");
        signal.throwIfAborted();
        return { bytes, extension, mime, finalUrl: url.href };
      } finally {
        await file.close();
      }
    }
  } catch (error) {
    incoming?.destroy();
    if (created) await rm(destination, { force: true });
    throw error;
  } finally {
    clearTimeout(timer);
    incoming?.destroy();
  }
}
