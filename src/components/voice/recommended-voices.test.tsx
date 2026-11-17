// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RECOMMENDED_KOKORO_VOICES } from "@/providers/voice/kokoro";

import { RecommendedVoices, sampleLine } from "./recommended-voices";

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "Audio",
    class {
      onended: (() => void) | null = null;
      play = () => Promise.resolve();
      pause = () => {};
    },
  );
  fetchMock.mockReset();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount(onPick?: (id: string) => void) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<RecommendedVoices onPick={onPick} />));
}

it("offers the six recommended voices, each with a play button", async () => {
  await mount();
  const buttons = container.querySelectorAll("button[aria-label^='Play']");
  expect(buttons).toHaveLength(6);
  expect(RECOMMENDED_KOKORO_VOICES).toHaveLength(6);
  expect(container.textContent).toContain("Heart");
  expect(container.textContent).toContain("default");
});

it("asks for a sample of that voice on this computer and plays it", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ audioUrl: "/media/p.wav" }),
  });
  await mount();
  const first = container.querySelector<HTMLButtonElement>(
    "button[aria-label^='Play']",
  )!;
  await act(async () => first.click());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/voice-preview");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    providerId: "kokoro-server",
    voiceId: RECOMMENDED_KOKORO_VOICES[0],
  });
  expect(body.text).toBe(sampleLine("Heart"));
  expect(container.querySelector("button[aria-label^='Stop']")).not.toBeNull();
});

it("shows the reason when a sample cannot be made", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error: "Kokoro server is not configured." }),
  });
  await mount();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>("button[aria-label^='Play']")!
      .click(),
  );
  expect(container.querySelector("[role='alert']")?.textContent).toContain(
    "not configured",
  );
});

it("lets a caller pick a voice", async () => {
  const onPick = vi.fn();
  await mount(onPick);
  const use = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Use",
  )!;
  await act(async () => use.click());
  expect(onPick).toHaveBeenCalledWith(RECOMMENDED_KOKORO_VOICES[0]);
});
