// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { VoiceGallery } from "./voice-gallery";

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
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<VoiceGallery />));
}

async function choose(label: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(
    `select[aria-label='${label}']`,
  )!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!;
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("lists every local voice with a play button", async () => {
  await mount();
  expect(container.querySelectorAll("button[aria-label^='Play']")).toHaveLength(
    54,
  );
});

it("filters by language and says pronunciation is approximate off English", async () => {
  await mount();
  await choose("Language", "es");
  expect(container.querySelectorAll("li")).toHaveLength(3);
  expect(container.textContent).toContain("English pronunciation rules");
  await choose("Language", "en-GB");
  expect(container.textContent).not.toContain("English pronunciation rules");
});

it("stars a voice, remembers it and can show only starred voices", async () => {
  await mount();
  const star = container.querySelector<HTMLButtonElement>(
    "button[aria-label='Star Heart']",
  )!;
  await act(async () => star.click());
  expect(localStorage.getItem("reel-studio.favourite-voices")).toBe(
    '["af_heart"]',
  );
  const only = [...container.querySelectorAll("label")]
    .find((l) => l.textContent?.includes("Starred only"))!
    .querySelector("input")!;
  await act(async () => only.click());
  expect(container.querySelectorAll("li")).toHaveLength(1);
});

it("plays a sample made on this computer", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ audioUrl: "/media/sample.wav" }),
  });
  await mount();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        "button[aria-label='Play a sample of Heart']",
      )!
      .click(),
  );
  expect(fetchMock.mock.calls[0]![0]).toBe("/api/voice-preview");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).voiceId).toBe("af_heart");
});
