import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  HyperFramesPlayer,
  type HyperFramesPlayerHandle,
} from "./hyperframes-player";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});
async function mount(onReady?: () => void) {
  const ref = createRef<HyperFramesPlayerHandle>();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <HyperFramesPlayer
        ref={ref}
        onReady={onReady}
        previewQuality="draft"
        scenes={[
          {
            id: "opening",
            templateId: "hf-opener",
            text: "A clear opening.",
            emphasis: [],
          },
        ]}
        timeline={[{ sceneId: "opening", startFrame: 0, durationFrames: 90 }]}
        fps={30}
        totalFrames={90}
      />,
    ),
  );
  const iframe = container.querySelector("iframe")!;
  const seek = vi.fn();
  Object.assign(iframe.contentWindow!, {
    __reelSeek: seek,
    __reelSetPlaying: vi.fn(),
  });
  await act(async () => iframe.dispatchEvent(new Event("load")));
  return { ref, seek, iframe };
}

it("shows a readable poster while keeping first playback at the start of the animation", async () => {
  const { ref, seek } = await mount();
  expect(seek).toHaveBeenLastCalledWith(1.2);
  expect(ref.current!.getCurrentFrame()).toBe(0);
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="Play"]')!.click(),
  );
  expect(seek).toHaveBeenLastCalledWith(0);
  expect(container.querySelector('[aria-label="Pause"]')).not.toBeNull();
});

it("honors deliberate seeks through iframe reloads and playback instead of restoring the poster", async () => {
  const { ref, seek, iframe } = await mount();
  await act(async () => ref.current!.seekTo(60));
  await act(async () => iframe.dispatchEvent(new Event("load")));
  expect(seek).toHaveBeenLastCalledWith(2);
  await act(async () => ref.current!.play());
  expect(seek).toHaveBeenLastCalledWith(2);
  expect(ref.current!.getCurrentFrame()).toBe(60);
});

it("starts an animatic when the draft iframe reports ready", async () => {
  const onReady = vi.fn();
  const { ref, iframe } = await mount(onReady);
  expect(iframe.srcdoc).toContain(
    "#root[data-grain]::before{display:none!important}",
  );
  expect(onReady).toHaveBeenCalled();
  onReady.mockImplementation(() => {
    ref.current?.seekTo(0);
    ref.current?.play();
  });
  await act(async () => iframe.dispatchEvent(new Event("load")));
  expect(container.querySelector('[aria-label="Pause"]')).not.toBeNull();
  expect(ref.current?.getCurrentFrame()).toBe(0);
});
