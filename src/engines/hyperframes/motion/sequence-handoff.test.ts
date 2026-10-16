import { it, expect } from "vitest";
import { gsap } from "gsap";
import { sequenceFixture } from "../../../../tests/fixtures/sequence-direction";
import { resolveSequenceContinuity } from "@/production/sequence-continuity";
import {
  buildSequenceHandoffs,
  SEQUENCE_HANDOFF_BOOT,
} from "./sequence-handoff";

it("keeps every overlay absent outside its own window, carries one card inside, and restores reverse seeks", () => {
  const props = sequenceFixture(),
    plan = resolveSequenceContinuity(props)!;
  document.body.innerHTML =
    plan.ports
      .map(
        (port) =>
          `<div data-subject-host="${port.subjectId}" data-subject-scene="${port.sceneId}" data-panel-index="${port.index}" style="opacity:1"></div>`,
      )
      .join("") + buildSequenceHandoffs(plan, props.tokens, 30, 1080, 1920);
  const timeline = gsap.timeline({ paused: true });
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-card-handoff]"),
  );
  for (const card of cards) {
    const local = gsap.timeline({ paused: true });
    new Function("stage", "tl", SEQUENCE_HANDOFF_BOOT)(card, local);
    timeline.add(local, Number(card.parentElement!.dataset.start));
    local.paused(false);
  }
  const opacity = (element: HTMLElement) =>
    Number(getComputedStyle(element).opacity || 1);
  try {
    timeline.seek(3, true);
    expect(cards.every((card) => opacity(card) === 0)).toBe(true);
    for (const card of cards) {
      const start = Number(card.parentElement!.dataset.start),
        duration = Number(card.parentElement!.dataset.duration);
      timeline.seek(start + duration / 2, true);
      expect(opacity(card)).toBe(1);
      const state = [
        card.style.left,
        card.style.top,
        card.style.width,
        card.style.height,
        card.style.opacity,
      ];
      timeline.seek(42, true);
      expect(cards.every((element) => opacity(element) === 0)).toBe(true);
      timeline.seek(start + duration / 2, true);
      expect([
        card.style.left,
        card.style.top,
        card.style.width,
        card.style.height,
        card.style.opacity,
      ]).toEqual(state);
      timeline.seek(0, true);
      expect(cards.every((element) => opacity(element) === 0)).toBe(true);
    }
  } finally {
    timeline.kill();
    gsap.ticker.sleep();
    document.body.innerHTML = "";
  }
});
