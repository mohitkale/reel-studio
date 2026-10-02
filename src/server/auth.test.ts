import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  authorize,
  authorizeRead,
  authorizeRequest,
  assertAllowedHost,
  requireWeb,
  isLoopbackHostname,
  requestHostname,
} from "@/server/auth";
import {
  assertSafeMediaUrl,
  isPrivateOrLocalHostname,
} from "@/lib/media-url-safety";
import { assertPathInsideRoot } from "@/server/url-safety";
import { ProviderError } from "@/providers/voice/types";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers: { host: new URL(url).host, ...headers } });
}

describe("auth loopback & same-origin", () => {
  const prevStrict = process.env.REEL_STRICT_AUTH;
  const prevTrust = process.env.TRUST_PROXY;
  const prevHosts = process.env.REEL_ALLOWED_HOSTS;
  const prevToken = process.env.MCP_API_TOKEN;
  const prevNamed = process.env.MCP_NAMED_TOKENS;

  beforeEach(() => {
    delete process.env.REEL_STRICT_AUTH;
    delete process.env.TRUST_PROXY;
    delete process.env.REEL_ALLOWED_HOSTS;
    delete process.env.MCP_API_TOKEN;
    delete process.env.MCP_NAMED_TOKENS;
  });

  afterEach(() => {
    if (prevStrict === undefined) delete process.env.REEL_STRICT_AUTH;
    else process.env.REEL_STRICT_AUTH = prevStrict;
    if (prevTrust === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prevTrust;
    if (prevHosts === undefined) delete process.env.REEL_ALLOWED_HOSTS;
    else process.env.REEL_ALLOWED_HOSTS = prevHosts;
    if (prevToken === undefined) delete process.env.MCP_API_TOKEN;
    else process.env.MCP_API_TOKEN = prevToken;
    if (prevNamed === undefined) delete process.env.MCP_NAMED_TOKENS;
    else process.env.MCP_NAMED_TOKENS = prevNamed;
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
    expect(authorize(req("http://127.0.0.1:3000/api/projects"))).toBe("web");
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

  it.each([undefined, "same-origin", "none"])(
    "rejects a LAN Host hidden by Next's localhost URL (%s)",
    (fetchSite) => {
      expect(() =>
        authorize(
          req("http://localhost:3000/api/projects", {
            host: "192.168.1.20:3000",
            ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}),
          }),
        ),
      ).toThrow("Untrusted request host");
    },
  );

  it.each(["1", "true", "yes"])(
    "strict auth %s requires a bearer for every browser signal",
    (value) => {
      process.env.REEL_STRICT_AUTH = value;
      const signals: Record<string, string>[] = [
        {},
        { "sec-fetch-site": "same-origin" },
        { "sec-fetch-site": "none" },
        { origin: "http://localhost:3000" },
      ];
      for (const headers of signals) {
        expect(() =>
          authorize(req("http://localhost:3000/api/projects", headers)),
        ).toThrow("Unauthorized");
      }
      process.env.MCP_API_TOKEN = "test-automation-token";
      const request = req("http://localhost:3000/api/projects", {
        authorization: "Bearer test-automation-token",
      });
      expect(authorize(request)).toBe("mcp");
      expect(() => requireWeb(request)).toThrow(
        "only available in the web app",
      );
    },
  );

  it("rejects a foreign Origin even with a forged same-origin signal", () => {
    expect(() =>
      authorize(
        req("http://localhost:3000/api/projects", {
          "sec-fetch-site": "same-origin",
          origin: "https://evil.example",
        }),
      ),
    ).toThrow("Unauthorized");
  });

  it.each(["cross-site", "same-site"])(
    "rejects %s subresources without Origin",
    (site) => {
      expect(() =>
        authorize(
          req("http://localhost:3000/api/projects", { "sec-fetch-site": site }),
        ),
      ).toThrow("Unauthorized");
    },
  );

  it.each([
    "",
    "localhost@evil.example",
    "localhost,evil.example",
    "localhost\\evil.example",
    "localhost:99999",
    "localhost.evil.example",
    "[::1]:99999",
  ])("rejects malformed or unknown Host %s", (host) => {
    expect(() =>
      assertAllowedHost(req("http://localhost:3000/api/x", { host })),
    ).toThrow("Untrusted request host");
  });

  it("rejects requests without raw Host", () => {
    expect(() => authorize(new Request("http://localhost:3000/api/x"))).toThrow(
      "Untrusted request host",
    );
  });

  it("does not let forwarded headers replace an untrusted raw Host", () => {
    process.env.TRUST_PROXY = "1";
    expect(() =>
      authorize(
        req("http://localhost:3000/api/x", {
          host: "evil.example",
          "x-forwarded-host": "localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toThrow("Untrusted request host");
  });

  it("checks Host before accepting even a valid token", () => {
    process.env.MCP_API_TOKEN = "test-automation-token";
    expect(() =>
      authorize(
        req("http://localhost:3000/api/x", {
          host: "evil.example",
          authorization: "Bearer test-automation-token",
        }),
      ),
    ).toThrow("Untrusted request host");
  });

  it("accepts IPv6 loopback without splitting its address at a colon", () => {
    expect(requestHostname(req("http://[::1]:3000/api/x"))).toBe("[::1]");
    expect(authorize(req("http://[::1]:3000/api/x"))).toBe("web");
  });

  it("requires a token for unidentified clients on configured remote hosts", () => {
    process.env.REEL_ALLOWED_HOSTS = " studio.example , [::1]";
    process.env.MCP_API_TOKEN = "test-automation-token";
    const url = "https://studio.example/api/x";
    expect(() => authorize(req(url))).toThrow("Unauthorized");
    expect(
      authorize(req(url, { authorization: "Bearer test-automation-token" })),
    ).toBe("mcp");
    expect(
      authorize(
        req("http://localhost:3000/api/x", {
          host: "studio.example",
          origin: "http://studio.example",
        }),
      ),
    ).toBe("web");
  });

  it("keeps named token scopes enforced for read endpoints", async () => {
    const { createHash } = await import("node:crypto");
    process.env.MCP_NAMED_TOKENS = JSON.stringify([
      {
        id: "test-token",
        name: "Reader",
        tokenHash: createHash("sha256").update("test-reader").digest("hex"),
        scopes: ["studio:read"],
        allowedProviders: [],
        paidProviders: [],
        maxDurationSeconds: 60,
        maxBatchSize: 1,
        paidRequestLimit: 0,
        paidRequestsUsed: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    ]);
    const request = req("http://localhost:3000/api/projects", {
      authorization: "Bearer test-reader",
    });
    expect(authorizeRead(request)).toBe("mcp");
    expect(() => authorize(request)).toThrow("does not grant studio:write");
    expect(() => authorizeRequest(request, "artifacts:read")).toThrow(
      "does not grant artifacts:read",
    );
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
    expect(() => assertSafeMediaUrl("http://127.0.0.1:8080/secret")).toThrow();
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
    expect(assertPathInsideRoot("/app/media", "/app/media/takes/a.wav")).toBe(
      "/app/media/takes/a.wav",
    );
  });
});
