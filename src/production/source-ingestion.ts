import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_SOURCE_CHARS = 12_000;
const MAX_REDIRECTS = 4;

type Address = { address: string; family: number };
type ResolveHost = (hostname: string) => Promise<Address[]>;
type FetchPage = (url: string) => Promise<Response>;

export interface IngestedArticle {
  url: string;
  title?: string;
  text: string;
}

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  return parts.length === 4 ? parts : null;
}

/** Reject loopback, link-local, private, documentation and multicast ranges. */
export function isPublicAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPublicAddress(mapped[1]);

  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }

  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (normalized.startsWith("ff")) return false;
  if (normalized.startsWith("2001:db8")) return false;
  return true;
}

async function defaultResolveHost(hostname: string): Promise<Address[]> {
  const result = await lookup(hostname, { all: true, verbatim: true });
  return result.map(({ address, family }) => ({ address, family }));
}

function requestedFamily(value: number | "IPv4" | "IPv6" | undefined) {
  if (value === 4 || value === "IPv4") return 4;
  if (value === 6 || value === "IPv6") return 6;
  return 0;
}

/**
 * Pin an outbound request to DNS answers that passed the public-address check.
 * Node 20+ may request every address for automatic IPv4/IPv6 selection, so the
 * callback must preserve the `options.all` result shape.
 */
export function createPublicLookup(resolveHost: ResolveHost): LookupFunction {
  return (hostname, options, callback) => {
    void resolveHost(hostname)
      .then((addresses) => {
        if (
          !addresses.length ||
          addresses.some(({ address }) => !isPublicAddress(address))
        ) {
          callback(
            new Error("Local and private network URLs are not allowed"),
            options.all ? [] : "",
            0,
          );
          return;
        }

        const family = requestedFamily(options.family);
        const eligible = family
          ? addresses.filter((address) => address.family === family)
          : addresses;
        if (!eligible.length) {
          callback(
            new Error(
              "Article hostname has no address in the requested family",
            ),
            options.all ? [] : "",
            0,
          );
          return;
        }

        if (options.all) {
          callback(null, eligible);
          return;
        }
        const selected = eligible[0]!;
        callback(null, selected.address, selected.family);
      })
      .catch((error: unknown) =>
        callback(
          error instanceof Error ? error : new Error("DNS lookup failed"),
          options.all ? [] : "",
          0,
        ),
      );
  };
}

/** Connect only through a DNS answer that passed the public-address check. */
async function requestPublicPage(
  value: string,
  resolveHost: ResolveHost,
): Promise<Response> {
  const url = new URL(value);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise<Response>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
          "User-Agent": "Reel-Studio/0.3 article-import",
        },
        lookup: createPublicLookup(resolveHost),
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > MAX_SOURCE_BYTES) {
            request.destroy(new Error("Article is too large to import"));
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("end", () => {
          const headers = new Headers();
          for (const [name, raw] of Object.entries(incoming.headers)) {
            for (const item of Array.isArray(raw) ? raw : raw ? [raw] : []) {
              headers.append(name, String(item));
            }
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: incoming.statusCode ?? 500,
              headers,
            }),
          );
        });
        incoming.on("error", reject);
      },
    );
    request.setTimeout(10_000, () =>
      request.destroy(new Error("Article request timed out")),
    );
    request.on("error", reject);
    request.end();
  });
}

export async function assertPublicArticleUrl(
  value: string,
  resolveHost: ResolveHost = defaultResolveHost,
): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Article URLs must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Article URLs cannot contain credentials");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Article URLs must use a standard web port");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local and private network URLs are not allowed");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolveHost(hostname);
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error("Local and private network URLs are not allowed");
  }
  return url;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function removeRepeatedSuffix(text: string): string {
  const anchorLength = 512;
  if (text.length < anchorLength * 2) return text;

  const anchorStart = text.length - anchorLength;
  const earlierAnchorStart = text.lastIndexOf(
    text.slice(anchorStart),
    anchorStart - anchorLength,
  );
  if (earlierAnchorStart < 0) return text;

  const repetitionDistance = anchorStart - earlierAnchorStart;
  if (repetitionDistance < anchorLength) return text;

  let repeatedSuffixStart = anchorStart;
  while (
    repeatedSuffixStart > repetitionDistance &&
    text[repeatedSuffixStart - 1] ===
      text[repeatedSuffixStart - repetitionDistance - 1]
  ) {
    repeatedSuffixStart -= 1;
  }

  return text.slice(0, repeatedSuffixStart).trim();
}

function htmlToText(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]
    ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim()
    : undefined;
  const text = removeRepeatedSuffix(
    decodeEntities(
      html
        .replace(
          /<(script|style|noscript|svg|canvas)\b[^>]*>[\s\S]*?<\/\1>/gi,
          " ",
        )
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(
          /<\/(p|div|article|section|main|h[1-6]|li|blockquote)>/gi,
          "\n",
        )
        .replace(/<[^>]+>/g, " "),
    )
      .replace(/[\t\r ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
  return { title, text };
}

async function readBoundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_SOURCE_BYTES) {
    throw new Error("Article is too large to import");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Article is too large to import");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Fetch public article text with bounded redirects and response size. */
export async function ingestPublicArticle(
  input: string,
  dependencies: { resolveHost?: ResolveHost; fetchPage?: FetchPage } = {},
): Promise<IngestedArticle> {
  const resolveHost = dependencies.resolveHost ?? defaultResolveHost;
  const fetchPage =
    dependencies.fetchPage ?? ((url) => requestPublicPage(url, resolveHost));

  let current = await assertPublicArticleUrl(input, resolveHost);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetchPage(current.href);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("Article redirected too many times");
      }
      current = await assertPublicArticleUrl(
        new URL(location, current).href,
        resolveHost,
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Article could not be fetched (HTTP ${response.status})`);
    }
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error("URL must return an HTML article or plain text");
    }
    const body = await readBoundedBody(response);
    const extracted = contentType.includes("text/html")
      ? htmlToText(body)
      : { text: body.trim(), title: undefined };
    if (extracted.text.length < 20) {
      throw new Error("The page did not contain enough readable text");
    }
    if (extracted.text.length > MAX_SOURCE_CHARS) {
      throw new Error(
        `Article contains more than ${MAX_SOURCE_CHARS.toLocaleString()} readable characters; paste the section you want to produce`,
      );
    }
    return {
      url: current.href,
      title: extracted.title?.slice(0, 160),
      text: extracted.text,
    };
  }
  throw new Error("Article redirected too many times");
}
