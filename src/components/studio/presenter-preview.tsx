"use client";

import * as React from "react";

import {
  characterSvg,
  type Character,
} from "@/engines/hyperframes/presenter/characters";
import { VISEMES, type Viseme } from "@/video/visemes";

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
export function PresenterPreview({ character }: { character: Character }) {
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
  return (
    <div
      aria-hidden
      className="w-28 shrink-0"
      // Trusted markup generated from the character table above.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export { VISEMES };
