import { describe, expect, it, vi } from "vitest";

import {
  assertPublicArticleUrl,
  createPublicLookup,
  ingestPublicArticle,
  isPublicAddress,
} from "@/production/source-ingestion";

const publicResolver = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 },
]);

describe("public article ingestion", () => {
  it("classifies private and public IP ranges", () => {
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("192.168.1.2")).toBe(false);
    expect(isPublicAddress("169.254.169.254")).toBe(false);
    expect(isPublicAddress("::1")).toBe(false);
    expect(isPublicAddress("fd00::1")).toBe(false);
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("returns the address array requested by Node automatic family selection", async () => {
    const lookup = createPublicLookup(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    await expect(
      new Promise((resolve, reject) =>
        lookup("example.com", { all: true }, (error, addresses) => {
          if (error) reject(error);
          else resolve(addresses);
        }),
      ),
    ).resolves.toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
  });

  it("rejects local names, private DNS answers, credentials, and non-web protocols", async () => {
    await expect(
      assertPublicArticleUrl("http://localhost/post", publicResolver),
    ).rejects.toThrow(/private/i);
    await expect(
      assertPublicArticleUrl("https://internal.example/post", async () => [
        { address: "10.1.2.3", family: 4 },
      ]),
    ).rejects.toThrow(/private/i);
    await expect(
      assertPublicArticleUrl(
        "https://user:pass@example.com/post",
        publicResolver,
      ),
    ).rejects.toThrow(/credentials/i);
    await expect(
      assertPublicArticleUrl("file:///etc/passwd", publicResolver),
    ).rejects.toThrow(/HTTP/i);
  });

  it("checks redirect destinations and extracts readable article text", async () => {
    const fetchPage = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          "<html><head><title>Useful &amp; Safe</title><script>ignore()</script></head><body><main><h1>A useful guide</h1><p>First clear paragraph.</p><p>Second clear paragraph with enough detail.</p></main></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
      );

    const result = await ingestPublicArticle("https://example.com/start", {
      resolveHost: publicResolver,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.url).toBe("https://www.example.com/final");
    expect(result.title).toBe("Useful & Safe");
    expect(result.text).toContain(
      "First clear paragraph.\nSecond clear paragraph",
    );
    expect(result.text).not.toContain("Useful & Safe");
    expect(result.text).not.toContain("ignore()");
  });

  it("keeps the X article body while removing title, login, and footer chrome", async () => {
    const result = await ingestPublicArticle(
      "https://x.com/creator/status/123",
      {
        resolveHost: publicResolver,
        fetchPage: async () =>
          new Response(
            `<html><head><title>Creator on X: &quot;Duplicated teaser&quot; / X</title></head><body>
              <nav>Article</nav><div>Log in Sign up</div>
              <main><p>Creator Name</p><p>@creator</p>
                <p>The actual opening belongs in the production.</p>
                <p>Comparison image Jev Jev is rendered beside this paragraph.</p>
                <p>The second insight should remain available too.</p>
                <p>6:33 PM · Sep 16, 2026 · 56</p><p>Views</p>
              </main>
              <aside>Log in or sign up for X</aside><footer>Trending now</footer>
            </body></html>`,
            { headers: { "content-type": "text/html" } },
          ),
      },
    );

    expect(result.title).toContain("Creator on X");
    expect(result.text).toBe(
      "The actual opening belongs in the production.\nThe second insight should remain available too.",
    );
    expect(result.text).not.toMatch(/Log in|Trending|Views/);
  });

  it("removes an exact repeated page suffix from responsive HTML markup", async () => {
    const article = `Article heading. ${"Complete article wording remains available for narration. ".repeat(14)}`;
    const result = await ingestPublicArticle("https://example.com/repeated", {
      resolveHost: publicResolver,
      fetchPage: async () =>
        new Response(
          `<main><p>Page introduction.</p><article>${article}</article><footer>Page actions</footer><article>${article}</article></main>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    });

    expect(result.text.match(/Article heading\./g)).toHaveLength(1);
    expect(result.text).toContain(article.trim());
  });

  it("blocks a redirect into a private network", async () => {
    const fetchPage = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
    );
    await expect(
      ingestPublicArticle("https://example.com/start", {
        resolveHost: publicResolver,
        fetchPage,
      }),
    ).rejects.toThrow(/private/i);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized responses before reading their body", async () => {
    await expect(
      ingestPublicArticle("https://example.com/large", {
        resolveHost: publicResolver,
        fetchPage: async () =>
          new Response("small", {
            status: 200,
            headers: {
              "content-type": "text/plain",
              "content-length": "1000001",
            },
          }),
      }),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects extracted copy beyond the planner limit instead of truncating it", async () => {
    await expect(
      ingestPublicArticle("https://example.com/long", {
        resolveHost: publicResolver,
        fetchPage: async () =>
          new Response(`Useful article ${"word ".repeat(2_500)}`, {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    ).rejects.toThrow(/paste the section/i);
  });
});
