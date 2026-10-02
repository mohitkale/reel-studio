// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBoundedBody, readBoundedFormData } from "./request-body";
import { errorResponse, readRequestJson } from "./api-helpers";
function streaming(
  stream: ReadableStream<Uint8Array>,
  headers: HeadersInit = {},
  signal?: AbortSignal,
) {
  return new Request("http://localhost/upload", {
    method: "POST",
    body: stream,
    headers,
    signal,
    duplex: "half",
  } as RequestInit);
}
afterEach(() => vi.useRealTimers());
describe("bounded inbound bodies", () => {
  it.each([new Headers(), new Headers({ "content-length": "1" })])(
    "counts bytes despite missing or dishonest length",
    async (headers) => {
      const cancel = vi.fn();
      let reads = 0;
      const req = streaming(
        new ReadableStream(
          {
            pull(c) {
              reads++;
              c.enqueue(new Uint8Array(4));
            },
            cancel,
          },
          { highWaterMark: 0 },
        ),
        headers,
      );
      await expect(readBoundedBody(req, 7)).rejects.toMatchObject({
        status: 413,
      });
      expect(reads).toBe(2);
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
  it("rejects declared oversized data before reading and malformed lengths as input errors", async () => {
    const pull = vi.fn();
    const cancel = vi.fn();
    await expect(
      readBoundedBody(
        streaming(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
          "content-length": "100",
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    await expect(
      readBoundedBody(
        streaming(new ReadableStream(), { "content-length": "-1" }),
        10,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("bounds a stalled body and releases timer/reader on abort", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const result = readBoundedBody(
      streaming(new ReadableStream({ cancel })),
      10,
      10,
    );
    const rejected = expect(result).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const caller = new AbortController();
    const pending = readBoundedBody(
      streaming(new ReadableStream(), {}, caller.signal),
      10,
    );
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves multipart uploads within the envelope and rejects malformed forms", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["fixture"], { type: "image/png" }),
      "fixture.png",
    );
    const req = new Request("http://localhost/upload", {
      method: "POST",
      body: form,
    });
    expect((await readBoundedFormData(req, 1024)).get("file")).toMatchObject({
      name: "fixture.png",
      size: 7,
    });
    await expect(
      readBoundedFormData(
        new Request("http://localhost/upload", {
          method: "POST",
          body: "invalid",
        }),
        100,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("applies JSON caps before parsing and exposes 413 instead of provider errors", async () => {
    let error: unknown;
    try {
      await readRequestJson(
        new Request("http://localhost/", {
          method: "POST",
          body: '{"x":"oversize"}',
        }),
        { maxBytes: 5 },
      );
    } catch (e) {
      error = e;
    }
    expect(errorResponse(error).status).toBe(413);
    await expect(
      readRequestJson(
        new Request("http://localhost/", { method: "POST", body: "{" }),
      ),
    ).rejects.toMatchObject({ message: "Invalid request input" });
  });
});
