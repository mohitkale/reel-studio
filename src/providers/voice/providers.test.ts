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
  process.env.VOICEFORGE_SERVICE_URL = "http://voiceforge.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CARTESIA_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.VOICEFORGE_SERVICE_URL;
  delete process.env.VOICEFORGE_API_TOKEN;
});

describe("registry", () => {
  it("validates provider ids", () => {
    expect(isProviderId("cartesia")).toBe(true);
    expect(isProviderId("kokoro")).toBe(true);
    expect(isProviderId("voiceforge")).toBe(true);
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

describe("client providers", () => {
  it("kokoro and webspeech are client-runtime with no server synth", () => {
    const kokoro = getProvider("kokoro");
    expect(kokoro.runtime).toBe("client");
    expect(kokoro.synth).toBeUndefined();
    expect(kokoro.isConfigured()).toBe(true);

    const webspeech = getProvider("webspeech");
    expect(webspeech.runtime).toBe("client");
    expect(webspeech.preview).toBe(true);
    expect(webspeech.synth).toBeUndefined();
  });

  it("kokoro exposes a curated voice catalog; webspeech enumerates client-side", async () => {
    const voices = await getProvider("kokoro").listVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.every((v) => /^[ab][fm]_/.test(v.id))).toBe(true);

    expect(await getProvider("webspeech").listVoices()).toEqual([]);
  });

  it("server providers remain server-runtime with a synth()", () => {
    expect(getProvider("cartesia").runtime).toBe("server");
    expect(typeof getProvider("cartesia").synth).toBe("function");
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

    const result = await getProvider("cartesia").synth!({
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

    const result = await getProvider("elevenlabs").synth!({
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

  it("falls back to wav_24000 and resamples when the plan blocks wav_44100", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: {
              type: "authorization_error",
              code: "subscription_required",
              message:
                "Output format 'wav_44100' is only available on the Pro tier and above.",
              status: "output_format_not_allowed",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(bytesResponse(makeSilentWav(0.25, { sampleRate: 24000 })));

    const result = await getProvider("elevenlabs").synth!({
      voiceId: "voice1",
      text: "hi",
    });

    expect(result.sampleRate).toBe(44100);
    expect(String(fetchMock.mock.calls[0][0])).toContain("output_format=wav_44100");
    expect(String(fetchMock.mock.calls[1][0])).toContain("output_format=wav_24000");
  });
});

describe("voiceforge", () => {
  it("is configured when VOICEFORGE_SERVICE_URL is set", () => {
    expect(getProvider("voiceforge").isConfigured()).toBe(true);
    delete process.env.VOICEFORGE_SERVICE_URL;
    expect(getProvider("voiceforge").isConfigured()).toBe(false);
    process.env.VOICEFORGE_SERVICE_URL = "http://voiceforge.test";
  });

  it("lists ready cloned voices and maps preview URLs to the proxy", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "v-ready",
          name: "My clone",
          engineId: "xtts-v2",
          tier: "instant",
          status: "ready",
          language: "en",
          previewUrl: "/v1/voices/v-ready/preview",
        },
        {
          id: "v-pending",
          name: "Still going",
          engineId: "f5-tts",
          tier: "instant",
          status: "processing",
          language: "en",
        },
      ]),
    );

    const voices = await getProvider("voiceforge").listVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0]).toMatchObject({
      id: "v-ready",
      name: "My clone",
      category: "cloned",
      previewUrl: "/api/voiceforge/voices/v-ready/preview",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voiceforge.test/v1/voices");
    expect((init as RequestInit).headers).toMatchObject({
      Accept: "application/json",
    });
  });

  it("lists engines as models", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: "xtts-v2", label: "XTTS-v2", ready: true },
        { id: "rvc", label: "RVC", ready: false },
      ]),
    );

    const models = await getProvider("voiceforge").listModels();
    expect(models).toEqual([
      {
        id: "xtts-v2",
        label: "XTTS-v2 · non-commercial · GPU recommended",
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://voiceforge.test/v1/engines");
  });

  it("synthesizes via POST /v1/synthesize and parses WAV", async () => {
    const wav = makeSilentWav(0.25);
    fetchMock.mockResolvedValueOnce(bytesResponse(wav));

    const result = await getProvider("voiceforge").synth!({
      voiceId: "v-ready",
      text: "hello world",
      speed: 1.1,
    });

    expect(result.sampleRate).toBe(44100);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voiceforge.test/v1/synthesize");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      voiceId: "v-ready",
      text: "hello world",
      sampleRate: 44100,
      speed: 1.1,
    });
    expect((init as RequestInit).headers).toMatchObject({
      Accept: "audio/wav",
      "Content-Type": "application/json",
    });
  });

  it("sends Authorization when VOICEFORGE_API_TOKEN is set", async () => {
    process.env.VOICEFORGE_API_TOKEN = "vf_secret";
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await getProvider("voiceforge").listVoices();

    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer vf_secret",
    });
  });
});
