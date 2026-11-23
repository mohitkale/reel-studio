"use client";

import * as React from "react";

import {
  characterSvg,
  type Character,
} from "@/engines/hyperframes/presenter/characters";
import { VISEMES, type Viseme } from "@/video/visemes";
import type { PresenterAdjustment } from "@/video/presenter-config";
import {
  presenterLayout,
  type PresenterPlacement,
} from "@/engines/hyperframes/presenter/build-presenter";

/** The rig with one mouth shape showing. The SVG is drawn by this app's own code, not user input. */
export function presenterSvgWith(character: Character, viseme: Viseme): string {
  return characterSvg(character)
    .replace(
      'id="pres-mouth-rest" opacity="1"',
      'id="pres-mouth-rest" opacity="0"',
    )
    .replace(
      `id="pres-mouth-${viseme}" opacity="0"`,
      `id="pres-mouth-${viseme}" opacity="1"`,
    );
}

const DEMO: Viseme[] = [
  "rest",
  "mbp",
  "ah",
  "eh",
  "ee",
  "l",
  "oh",
  "oo",
  "fv",
  "sz",
  "r",
  "sh",
];

/**
 * A small live preview: the presenter says through all twelve mouth shapes and
 * blinks, so you can see the character before choosing it. Holds still when
 * motion is reduced.
 */
export function PresenterPreview({
  character,
  placement,
  frame,
  adjustment,
}: {
  character: Character;
  placement: PresenterPlacement;
  frame: { width: number; height: number };
  adjustment?: PresenterAdjustment;
}) {
  const [step, setStep] = React.useState(0);
  const reduced = React.useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  React.useEffect(() => {
    if (reduced) return;
    const timer = setInterval(
      () => setStep((s) => (s + 1) % (DEMO.length * 2)),
      220,
    );
    return () => clearInterval(timer);
  }, [reduced]);
  const viseme = reduced ? "rest" : DEMO[step % DEMO.length]!;
  const svg = presenterSvgWith(character, viseme);
  const { presenter, circle } = presenterLayout(placement, frame, adjustment);
  const percent = (pixels: number, size: number) => `${(pixels / size) * 100}%`;
  return (
    <div
      aria-hidden
      className="bg-muted relative h-28 shrink-0 overflow-hidden rounded border"
      style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
    >
      <div
        className={
          circle
            ? "absolute overflow-hidden rounded-full [&>svg]:translate-y-[7%] [&>svg]:scale-[1.18]"
            : "absolute"
        }
        style={{
          left: percent(presenter.left, frame.width),
          top: percent(presenter.top, frame.height),
          width: percent(presenter.width, frame.width),
          height: percent(presenter.height, frame.height),
          ...(circle ? { backgroundColor: character.accent } : {}),
        }}
        // Trusted markup generated from the character table above.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export { VISEMES };
