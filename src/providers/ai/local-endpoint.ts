import { lookup as nodeLookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { LocalAIProviderId } from "./local-types";

type LookupAddress = { address: string; family: number };
export type LocalAILookup = (
  hostname: string,
) => Promise<readonly LookupAddress[]>;

export class LocalAIEndpointError extends Error {
  constructor(
    message: string,
    readonly providerId?: LocalAIProviderId,
    readonly status = 400,
  ) {
    super(message);
    this.name = "LocalAIEndpointError";
  }
}

function ipv4Scope(address: string): "loopback" | "lan" | "blocked" {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return "blocked";
  }
  const [a, b] = parts;
  if (a === 127) return "loopback";
  if (
    a === 10 ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  ) {
    return "lan";
  }
  return "blocked";
}

export function localAddressScope(
  rawAddress: string,
): "loopback" | "lan" | "blocked" {
  const address = rawAddress.toLowerCase().split("%")[0]!;
  if (address.startsWith("::ffff:")) {
    return ipv4Scope(address.slice("::ffff:".length));
  }
  if (isIP(address) === 4) return ipv4Scope(address);
  if (isIP(address) === 6) {
    if (address === "::1" || address === "0:0:0:0:0:0:0:1") {
      return "loopback";
    }
    if (address.startsWith("fc") || address.startsWith("fd")) return "lan";
    if (/^fe[89ab]/.test(address)) return "lan";
  }
  return "blocked";
}

async function defaultLookup(hostname: string): Promise<LookupAddress[]> {
  if (isIP(hostname)) {
    return [{ address: hostname, family: isIP(hostname) }];
  }
  return nodeLookup(hostname, { all: true, verbatim: true });
}

export async function validateLocalAIEndpoint(
  rawUrl: string,
  allowLan: boolean,
  lookup: LocalAILookup = defaultLookup,
): Promise<{
  baseUrl: string;
  scope: "loopback" | "lan";
  addresses: string[];
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new LocalAIEndpointError("Enter a valid local AI server URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LocalAIEndpointError(
      "Local AI endpoints must use http:// or https://.",
    );
  }
  if (parsed.username || parsed.password) {
    throw new LocalAIEndpointError(
      "Put authentication in the token field, not in the endpoint URL.",
    );
  }
  if (parsed.search || parsed.hash) {
    throw new LocalAIEndpointError(
      "Local AI endpoint URLs cannot include a query string or fragment.",
    );
  }

  let resolved: readonly LookupAddress[];
  try {
    resolved = await lookup(parsed.hostname);
  } catch (error) {
    throw new LocalAIEndpointError(
      `Could not resolve local AI host ${parsed.hostname}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (resolved.length === 0) {
    throw new LocalAIEndpointError(
      `Local AI host ${parsed.hostname} did not resolve to an address.`,
    );
  }

  const scopes = resolved.map((item) => localAddressScope(item.address));
  if (scopes.includes("blocked")) {
    throw new LocalAIEndpointError(
      "Local AI endpoints must resolve only to loopback or private LAN addresses.",
    );
  }
  const scope = scopes.includes("lan") ? "lan" : "loopback";
  if (scope === "lan" && !allowLan) {
    throw new LocalAIEndpointError(
      "This endpoint resolves to your LAN. Enable LAN access explicitly before saving it.",
    );
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return {
    baseUrl: parsed.toString().replace(/\/$/, ""),
    scope,
    addresses: [...new Set(resolved.map((item) => item.address))],
  };
}
