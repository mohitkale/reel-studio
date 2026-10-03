import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SceneTimeline } from "./scene-timeline";
it("selects and reorders saved scene identities with disabled boundary actions", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSelect = vi.fn(),
    onMove = vi.fn();
  try {
    await act(async () =>
      root.render(
        <SceneTimeline
          scenes={[
            { id: "a", text: "First" },
            { id: "b", text: "Second" },
          ]}
          timeline={[
            { sceneId: "a", startFrame: 0, durationFrames: 60 },
            { sceneId: "b", startFrame: 60, durationFrames: 90 },
          ]}
          fps={30}
          selectedId="a"
          onSelect={onSelect}
          onMove={onMove}
          busy={false}
          measured={false}
        />,
      ),
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Move scene 1 earlier"]',
      )!.disabled,
    ).toBe(true);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Preview scene 2"]')!
        .click(),
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Move scene 2 earlier"]',
        )!
        .click(),
    );
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onMove).toHaveBeenCalledWith("b", -1);
    expect(container.textContent).toContain("Estimated timing");
    expect(container.textContent).toContain("3.0s");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
