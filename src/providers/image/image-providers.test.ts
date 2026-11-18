import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createComfyUIProvider } from "./comfyui";
import { createOpenAICompatibleImageProvider } from "./openai-compatible";
import {
  imageCacheKey,
  imageSeed,
  imageSize,
  imageStyleForTheme,
} from "./style";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("fake image data"),
]);

let server: http.Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

async function serve(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

const input = {
  prompt: "a lighthouse at dusk",
  style: "cinematic still",
  seed: 7,
  width: 576,
  height: 1024,
};

describe("ComfyUI", () => {
  it("queues a text-to-image graph, waits for the history and downloads the picture", async () => {
    const seen: { path: string; body?: string }[] = [];
    const baseUrl = await serve((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        seen.push({ path: req.url!, body });
        res.setHeader("content-type", "application/json");
        if (req.url === "/object_info/CheckpointLoaderSimple")
          return res.end(
            JSON.stringify({
              CheckpointLoaderSimple: {
                input: { required: { ckpt_name: [["sd15.safetensors"]] } },
              },
            }),
          );
        if (req.url === "/prompt")
          return res.end(JSON.stringify({ prompt_id: "abc" }));
        if (req.url === "/history/abc")
          return res.end(
            JSON.stringify({
              abc: {
                outputs: {
                  "9": {
                    images: [
                      { filename: "reel_1.png", subfolder: "", type: "output" },
                    ],
                  },
                },
              },
            }),
          );
        if (req.url!.startsWith("/view")) {
          res.setHeader("content-type", "image/png");
          return res.end(PNG);
        }
        res.statusCode = 404;
        res.end("{}");
      });
    });
    const provider = createComfyUIProvider(
      { providerId: "comfyui", baseUrl, model: "", allowLan: false },
      { pollMs: 5 },
    );
    const image = await provider.generate(input);
    expect(image.mime).toBe("image/png");
    expect(image.bytes.equals(PNG)).toBe(true);
    const queued = JSON.parse(seen.find((s) => s.path === "/prompt")!.body!);
    expect(queued.prompt["4"].inputs.ckpt_name).toBe("sd15.safetensors");
    expect(queued.prompt["3"].inputs.seed).toBe(7);
    expect(queued.prompt["5"].inputs).toMatchObject({
      width: 576,
      height: 1024,
    });
    expect(queued.prompt["6"].inputs.text).toContain(
      "a lighthouse at dusk, cinematic still",
    );
  });

  it("tests the server and names a missing checkpoint", async () => {
    const baseUrl = await serve((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [["a.safetensors"]] } },
          },
        }),
      );
    });
    const good = await createComfyUIProvider({
      providerId: "comfyui",
      baseUrl,
      model: "a.safetensors",
      allowLan: false,
    }).test();
    expect(good.ok).toBe(true);
    const bad = await createComfyUIProvider({
      providerId: "comfyui",
      baseUrl,
      model: "nope.safetensors",
      allowLan: false,
    }).test();
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain("nope.safetensors");
  });

  it("reports a server that is not running", async () => {
    const result = await createComfyUIProvider({
      providerId: "comfyui",
      baseUrl: "http://127.0.0.1:1",
      model: "",
      allowLan: false,
    }).test();
    expect(result.ok).toBe(false);
  });

  it("refuses an address outside this computer and the private network", async () => {
    const result = await createComfyUIProvider({
      providerId: "comfyui",
      baseUrl: "http://8.8.8.8:8188",
      model: "",
      allowLan: false,
    }).test();
    expect(result.ok).toBe(false);
  });
});

describe("OpenAI-compatible image server", () => {
  it("asks for one base64 picture at the right size", async () => {
    let request: Record<string, unknown> = {};
    const baseUrl = await serve((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        request = body ? JSON.parse(body) : {};
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }),
        );
      });
    });
    const provider = createOpenAICompatibleImageProvider({
      providerId: "openai-compatible",
      baseUrl,
      model: "sdxl",
      allowLan: false,
    });
    const image = await provider.generate({
      ...input,
      width: 1024,
      height: 576,
    });
    expect(image.bytes.equals(PNG)).toBe(true);
    expect(request).toMatchObject({
      size: "1024x576",
      model: "sdxl",
      n: 1,
      seed: 7,
    });
  });

  it("rejects a reply that is not an image, and never follows a link to another site", async () => {
    const notImage = await serve((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("hello").toString("base64") }],
        }),
      );
    });
    await expect(
      createOpenAICompatibleImageProvider({
        providerId: "openai-compatible",
        baseUrl: notImage,
        model: "",
        allowLan: false,
      }).generate(input),
    ).rejects.toThrow(/PNG, JPEG or WebP/);
    server?.close();
    const elsewhere = await serve((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [{ url: "http://example.com/x.png" }] }));
    });
    await expect(
      createOpenAICompatibleImageProvider({
        providerId: "openai-compatible",
        baseUrl: elsewhere,
        model: "",
        allowLan: false,
      }).generate(input),
    ).rejects.toThrow(/another site/);
  });
});

describe("image style, seed and cache key", () => {
  it("gives each look its own style and a default for the rest", () => {
    expect(imageStyleForTheme("neon")).toContain("neon");
    expect(imageStyleForTheme("cinematic")).not.toBe(
      imageStyleForTheme("neon"),
    );
    expect(imageStyleForTheme("unknown")).toContain("no text");
  });

  it("derives a stable seed per video and scene", () => {
    expect(imageSeed("video", 0)).toBe(imageSeed("video", 0));
    expect(imageSeed("video", 0)).not.toBe(imageSeed("video", 1));
    expect(imageSeed("video", 0)).not.toBe(imageSeed("other", 0));
    expect(imageSeed("video", 3)).toBeLessThan(2 ** 31);
  });

  it("sizes the picture to the frame and keys the cache on everything that matters", () => {
    expect(imageSize("portrait")).toEqual({ width: 576, height: 1024 });
    const parts = {
      providerId: "comfyui",
      model: "m",
      prompt: "p",
      style: "s",
      seed: 1,
      width: 64,
      height: 64,
    };
    expect(imageCacheKey(parts)).toBe(imageCacheKey({ ...parts }));
    expect(imageCacheKey(parts)).not.toBe(imageCacheKey({ ...parts, seed: 2 }));
    expect(imageCacheKey(parts)).not.toBe(
      imageCacheKey({ ...parts, model: "n" }),
    );
  });
});
