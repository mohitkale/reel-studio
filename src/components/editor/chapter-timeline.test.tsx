import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ChapterTimeline } from "./chapter-timeline";

it("navigates saved chapters, retains global scene numbering and exposes recap context", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    onSelect = vi.fn();
  try {
    await act(async () =>
      root.render(
        <ChapterTimeline
          scenes={[
            { id: "a", text: "Develop" },
            { id: "b", text: "Return" },
          ]}
          timeline={[
            { sceneId: "a", startFrame: 0, durationFrames: 1800 },
            { sceneId: "b", startFrame: 1800, durationFrames: 1800 },
          ]}
          fps={30}
          selectedId="b"
          onSelect={onSelect}
          onMove={vi.fn()}
          busy={false}
          measured
          plan={{
            version: "1.0.0",
            longForm: { version: "1.0.0", targetSeconds: 180 },
            chapters: [
              {
                id: "first",
                title: "Original",
                firstSceneId: "a",
                direction: {
                  goal: "Explain the supplied process",
                  phase: "develop",
                },
              },
              {
                id: "last",
                title: "Return",
                firstSceneId: "b",
                direction: {
                  goal: "Revisit the supplied process",
                  phase: "recap",
                  callbackChapterId: "first",
                },
              },
            ],
          }}
        />,
      ),
    );
    expect(container.textContent).toContain(
      "Narration timing · 2.0 min · Target 3.0 min",
    );
    expect(container.textContent).toContain("Returns to Original");
    expect(container.querySelectorAll("details")[1].open).toBe(true);
    expect(container.querySelectorAll("details")[0].open).toBe(false);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Chapter overview"] button',
        )!
        .click(),
    );
    expect(onSelect).toHaveBeenCalledWith("a");
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Preview scene 2"]')!
        .click(),
    );
    expect(onSelect).toHaveBeenLastCalledWith("b");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
