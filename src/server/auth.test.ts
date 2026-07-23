import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  authorize,
  isLoopbackHostname,
  requestHostname,
} from "@/server/auth";
import { assertSafeMediaUrl, isPrivateOrLocalHostname } from "@/lib/media-url-safety";
import { assertPathInsideRoot } from "@/server/url-safety";
import { ProviderError } from "@/providers/voice/types";

function req(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers });
}

describe("auth loopback & same-origin", () => {
  const prevStrict = process.env.REEL_STRICT_AUTH;
  const prevTrust = process.env.TRUST_PROXY;

  beforeEach(() => {
    delete process.env.REEL_STRICT_AUTH;
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    if (prevStrict === undefined) delete process.env.REEL_STRICT_AUTH;
    else process.env.REEL_STRICT_AUTH = prevStrict;
    if (prevTrust === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prevTrust;
  });

  it("recognises loopback hostnames", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("192.168.1.10")).toBe(false);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });

  it("allows same-origin browser requests", () => {
    expect(
      authorize(
        req("http://localhost:3000/api/projects", {
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe("web");
  });

  it("allows unidentified clients only on loopback", () => {
    expect(
      authorize(req("http://127.0.0.1:3000/api/projects")),
    ).toBe("web");
  });

  it("rejects unidentified clients on LAN hosts", () => {
    expect(() =>
      authorize(req("http://192.168.1.20:3000/api/projects")),
    ).toThrow(ProviderError);
  });

  it("rejects direct navigation on non-loopback hosts", () => {
    expect(() =>
      authorize(
        req("http://10.0.0.5:3000/media/x.wav", {
          "sec-fetch-site": "none",
        }),
      ),
    ).toThrow(ProviderError);
  });

  it("does not trust X-Forwarded-Host by default", () => {
    expect(
      requestHostname(
        req("http://127.0.0.1:3000/api/x", {
          "x-forwarded-host": "evil.example",
        }),
      ),
    ).toBe("127.0.0.1");
  });
});

describe("media URL safety", () => {
  it("allows /media and /music paths", () => {
    expect(() => assertSafeMediaUrl("/media/takes/a.wav")).not.toThrow();
    expect(() => assertSafeMediaUrl("/music/bed.mp3")).not.toThrow();
  });

  it("rejects path traversal in relative URLs", () => {
    expect(() => assertSafeMediaUrl("/media/../.env.local")).toThrow();
    expect(() => assertSafeMediaUrl("/music/../../etc/passwd")).toThrow();
  });

  it("rejects private remote hosts", () => {
    expect(isPrivateOrLocalHostname("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHostname("10.1.2.3")).toBe(true);
    expect(isPrivateOrLocalHostname("169.254.169.254")).toBe(true);
    expect(isPrivateOrLocalHostname("images.unsplash.com")).toBe(false);
    expect(() =>
      assertSafeMediaUrl("http://127.0.0.1:8080/secret"),
    ).toThrow();
    expect(() =>
      assertSafeMediaUrl("https://images.unsplash.com/photo-1"),
    ).not.toThrow();
  });
});

describe("path containment", () => {
  it("blocks escape from root", () => {
    expect(() =>
      assertPathInsideRoot("/app/media", "/app/media/../.env.local"),
    ).toThrow();
    expect(
      assertPathInsideRoot("/app/media", "/app/media/takes/a.wav"),
    ).toBe("/app/media/takes/a.wav");
  });
});
