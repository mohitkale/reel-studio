import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { makeSilentWav } from "@/lib/wav";
import { getProvider, isProviderId } from "./registry";
import { ProviderError } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function bytesResponse(buf: Buffer, status = 200): Response {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => ab,
    text: async () => "",
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.CARTESIA_API_KEY = "sk_car_test";
  process.env.ELEVENLABS_API_KEY = "el_test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CARTESIA_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
});

describe("registry", () => {
  it("validates provider ids", () => {
    expect(isProviderId("cartesia")).toBe(true);
    expect(isProviderId("nope")).toBe(false);
  });

  it("throws on unknown provider", () => {
    // @ts-expect-error testing the guard at runtime
    expect(() => getProvider("nope")).toThrow(ProviderError);
  });

  it("reflects key presence via isConfigured", () => {
    expect(getProvider("cartesia").isConfigured()).toBe(true);
    delete process.env.CARTESIA_API_KEY;
    expect(getProvider("cartesia").isConfigured()).toBe(false);
  });
});

describe("cartesia", () => {
  it("merges owned (cloned) and library voices and de-dupes by id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "v1", name: "mohit", is_owner: true, language: "en" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "v1", name: "mohit", is_owner: false, is_public: true },
            { id: "v2", name: "Library Voice", is_public: true },
          ],
        }),
      );

    const voices = await getProvider("cartesia").listVoices();
    expect(voices).toHaveLength(2);
    expect(voices.find((v) => v.id === "v1")?.category).toBe("cloned");
    expect(voices.find((v) => v.id === "v2")?.category).toBe("default");
  });

  it("sends the correct synth body and returns a 44100 WAV", async () => {
    const wav = makeSilentWav(0.25);
    fetchMock.mockResolvedValueOnce(bytesResponse(wav));

    const result = await getProvider("cartesia").synth({
      voiceId: "abc",
      text: "hello",
    });

    expect(result.sampleRate).toBe(44100);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cartesia.ai/tts/bytes");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model_id).toBe("sonic-3.5");
    expect(body.voice).toEqual({ mode: "id", id: "abc" });
    expect(body.output_format).toEqual({
      container: "wav",
      encoding: "pcm_s16le",
      sample_rate: 44100,
    });
    expect((init as RequestInit).headers).toMatchObject({
      "Cartesia-Version": "2026-03-01",
    });
  });

  it("maps a 401 to an actionable ProviderError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 401));
    await expect(getProvider("cartesia").listVoices()).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("elevenlabs", () => {
  it("normalizes categories from the v2 voices response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        voices: [
          { voice_id: "a", name: "Cloned", category: "cloned" },
          { voice_id: "b", name: "Pro", category: "professional" },
          { voice_id: "c", name: "Stock", category: "premade" },
        ],
      }),
    );

    const voices = await getProvider("elevenlabs").listVoices();
    expect(voices.map((v) => v.category)).toEqual([
      "cloned",
      "professional",
      "default",
    ]);
  });

  it("requests wav_44100 with the default model", async () => {
    const wav = makeSilentWav(0.25);
    fetchMock.mockResolvedValueOnce(bytesResponse(wav));

    const result = await getProvider("elevenlabs").synth({
      voiceId: "xy z",
      text: "hi",
    });

    expect(result.sampleRate).toBe(44100);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/text-to-speech/xy%20z");
    expect(String(url)).toContain("output_format=wav_44100");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model_id).toBe("eleven_multilingual_v2");
  });
});
