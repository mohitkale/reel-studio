import { describe, expect, it, vi } from "vitest";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { motionDirection } from "@/production/motion";
import { defaultBrandTokens } from "@/compositions/tokens";
import type { ReelProps } from "@/compositions/types";
import { dimsFor, ORIENTATIONS } from "@/lib/orientation";

function fixture(): ReelProps & { tokens: typeof defaultBrandTokens } {
  return {
    scenes: [
      {
        id: "device",
        text: "See it in action",
        templateId: "hf-opener",
        emphasis: [],
        motion: motionDirection("media-device"),
        background: {
          type: "video",
          url: "/media/clip.mp4?x=1&y=2",
          muted: false,
        },
      },
      {
        id: "cover",
        text: "A wider story",
        templateId: "hf-opener",
        emphasis: [],
        motion: motionDirection("media-cinematic"),
        background: { type: "video", url: "/media/hero.mp4", muted: false },
      },
    ],
    timeline: [
      { sceneId: "device", startFrame: 30, durationFrames: 90 },
      { sceneId: "cover", startFrame: 120, durationFrames: 90 },
    ],
    fps: 30,
    tokens: defaultBrandTokens,
  };
}

describe("motion footage", () => {
  it.each(ORIENTATIONS)(
    "stages one timed muted decoder per media scene in %s export",
    (orientation) => {
      const html = buildHyperframesCompositionHtml(
        { ...fixture(), ...dimsFor(orientation) },
        { producerMode: true },
      );
      const doc = new DOMParser().parseFromString(html, "text/html");
      const videos = Array.from(doc.querySelectorAll("video"));
      expect(videos).toHaveLength(2);
      expect(videos[0].getAttribute("src")).toBe("/media/clip.mp4?x=1&y=2");
      expect(videos[0].closest(".pl-media")).not.toBeNull();
      expect(videos[1].classList.contains("cb-media")).toBe(true);
      expect(doc.querySelector("img.cb-media")).toBeNull();
      expect(doc.querySelector(".bg-video")).toBeNull();
      for (const [index, video] of videos.entries()) {
        expect(video.getAttribute("data-start")).toBe(
          index === 0 ? "1.000" : "4.000",
        );
        expect(video.getAttribute("data-duration")).toBe("3.000");
        expect(video.getAttribute("data-media-start")).toBe("0");
        expect(video.hasAttribute("muted")).toBe(true);
        expect(video.hasAttribute("autoplay")).toBe(false);
        expect(video.hasAttribute("loop")).toBe(false);
      }
      expect(html).not.toContain("function syncTimedVideos");
    },
  );

  it("seeks editor footage backward, hides inactive sources and holds short clips without restarting", () => {
    const html = buildHyperframesCompositionHtml(fixture());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const videos = Array.from(doc.querySelectorAll("video"));
    const scope: {
      innerWidth: number;
      innerHeight: number;
      addEventListener: () => void;
      __reelSeek?: (seconds: number) => void;
      __reelSetPlaying?: (playing: boolean) => void;
    } = { innerWidth: 400, innerHeight: 800, addEventListener: vi.fn() };
    const players = videos.map((video) => {
      let paused = true;
      Object.defineProperty(video, "duration", { value: 2 });
      Object.defineProperty(video, "paused", { get: () => paused });
      const play = vi.fn(() => {
        paused = false;
        return Promise.resolve();
      });
      const pause = vi.fn(() => {
        paused = true;
      });
      video.play = play;
      video.pause = pause;
      return { play, pause };
    });
    const preview = Array.from(doc.querySelectorAll("script")).find((script) =>
      script.textContent?.includes("function syncTimedVideos"),
    )?.textContent;
    expect(preview).toBeTruthy();
    new Function("window", "document", "setInterval", "setTimeout", preview!)(
      scope,
      doc,
      vi.fn(),
      vi.fn(),
    );
    expect(videos.every((video) => video.style.visibility === "hidden")).toBe(
      true,
    );
    scope.__reelSeek!(2.5);
    expect(videos[0].currentTime).toBe(1.5);
    expect(videos[0].style.visibility).toBe("visible");
    scope.__reelSetPlaying!(true);
    expect(players[0].play).toHaveBeenCalledTimes(1);
    scope.__reelSetPlaying!(false);
    expect(players[0].pause).toHaveBeenCalledTimes(1);
    scope.__reelSeek!(1.25);
    expect(videos[0].currentTime).toBe(0.25);
    scope.__reelSeek!(3.5);
    expect(videos[0].currentTime).toBeCloseTo(2 - 1 / 30);
    scope.__reelSetPlaying!(true);
    expect(players[0].play).toHaveBeenCalledTimes(1);
    scope.__reelSeek!(4.5);
    expect(videos[0].style.visibility).toBe("hidden");
    expect(videos[1].style.visibility).toBe("visible");
    expect(videos[1].currentTime).toBe(0.5);
    scope.__reelSeek!(7);
    expect(videos[0].style.visibility).toBe("hidden");
    expect(videos[1].style.visibility).toBe("visible");
    expect(videos[1].currentTime).toBeCloseTo(2 - 1 / 30);
    expect(videos.every((video) => video.muted)).toBe(true);
  });
});
