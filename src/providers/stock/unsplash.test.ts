import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createUnsplashProvider } from "./unsplash";
import { StockError } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.UNSPLASH_ACCESS_KEY = "ak_test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UNSPLASH_ACCESS_KEY;
});

describe("unsplash provider", () => {
  it("reflects key presence via isConfigured", () => {
    expect(createUnsplashProvider().isConfigured()).toBe(true);
    delete process.env.UNSPLASH_ACCESS_KEY;
    expect(createUnsplashProvider().isConfigured()).toBe(false);
  });

  it("throws when searching without a key", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    await expect(
      createUnsplashProvider().search("mountains", "portrait"),
    ).rejects.toBeInstanceOf(StockError);
  });

  it("maps results to StockImage and sends orientation + auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            urls: { regular: "https://img/regular.jpg", small: "https://img/small.jpg" },
            links: { html: "https://unsplash.com/p/1", download_location: "https://api/dl/1" },
            user: { name: "Jane Doe", links: { html: "https://unsplash.com/@jane" } },
          },
        ],
      }),
    );

    const images = await createUnsplashProvider().search("calm ocean", "landscape", 3);

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      url: "https://img/regular.jpg",
      thumbUrl: "https://img/small.jpg",
      credit: "Jane Doe",
      creditUrl: "https://unsplash.com/@jane",
      downloadLocation: "https://api/dl/1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("orientation=landscape");
    expect(String(url)).toContain("query=calm+ocean");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Client-ID ak_test",
    );
  });

  it("maps the square orientation to Unsplash 'squarish'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [] }));
    await createUnsplashProvider().search("logo", "square");
    expect(String(fetchMock.mock.calls[0][0])).toContain("orientation=squarish");
  });

  it("raises a StockError on a rejected key (401)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errors: ["bad"] }, 401));
    await expect(
      createUnsplashProvider().search("x", "portrait"),
    ).rejects.toBeInstanceOf(StockError);
  });

  it("drops results without a usable url", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ results: [{ urls: {}, user: { name: "x" } }] }),
    );
    const images = await createUnsplashProvider().search("x", "portrait");
    expect(images).toHaveLength(0);
  });
});
