import { describe, it, expect } from "vitest";
import { sequenceFixture } from "../../tests/fixtures/sequence-direction";
import {
  collectSequenceSubjects,
  findSequenceSubject,
  sequenceSourceKey,
} from "./sequence-subjects";
import { subjectRegistrySchema } from "@/video/sequence-direction";
import { resolveSequenceContinuity } from "./sequence-continuity";
import { planMotionSequence } from "./motion-plan";
import { SEQUENCE_SEARCH } from "./sequence-planner";
import { sectionVisualProps } from "./section-visuals";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { filmSnapshot } from "../../tests/fixtures/film-plan";
import { withResolvedFilmPlan, filmPlanMatchesSource } from "./film-plan";
import { prepareVideoComposition } from "@/library/render-service";
import { preparedVideoCompositionSchema } from "./video-snapshot";
import { resolveReelTimeline } from "@/lib/reel-timeline";

describe("M3 sequence direction", () => {
  it("preserves IDs/colors across order changes and uses only exact labels or explicit aliases", () => {
    const source = [{ items: ["Draft", "Publish", "draft", "Drafting"] }];
    const registry = collectSequenceSubjects(source);
    expect(registry).toHaveLength(4);
    expect(collectSequenceSubjects([{ items: ["Publish", "Draft"] }])).toEqual(
      registry.filter((s) => ["Publish", "Draft"].includes(s.label)),
    );
    const saved = registry.map((s) =>
      s.label === "Draft"
        ? {
            ...s,
            aliases: ["First pass"],
            colorSlot: "accentSecondary" as const,
          }
        : s,
    );
    expect(collectSequenceSubjects([{ items: ["First pass"] }], saved)).toEqual(
      saved,
    );
    expect(findSequenceSubject(saved, "First pass")).toEqual(
      saved.find((s) => s.label === "Draft"),
    );
    expect(
      subjectRegistrySchema.safeParse([
        ...saved,
        { ...saved[0], id: "ambiguous", aliases: ["Draft"] },
      ]).success,
    ).toBe(false);
  });
  it("uses bounded lookahead to reduce unmotivated repeated silhouettes against M2 greedy selection", () => {
    const scenes = Array.from({ length: 12 }, (_, index) => ({
      text: `A concise supplied statement for beat ${index}.`,
      role: "explanation" as const,
    }));
    const settings = {
      version: "1.0.0" as const,
      seed: "benchmark",
      system: "precision" as const,
      ambition: "expressive" as const,
      adaptiveRecipes: true,
    };
    const greedy = planMotionSequence(scenes, settings),
      directed = planMotionSequence(scenes, {
        ...settings,
        sequenceDirection: true,
      });
    const repeats = (values: (string | undefined)[]) =>
      values.slice(1).filter((v, i) => v === values[i]).length;
    expect(
      repeats(directed.map((m) => m?.decision?.profile.silhouette)),
    ).toBeLessThan(repeats(greedy.map((m) => m?.recipeId)));
    expect(
      planMotionSequence(scenes, { ...settings, sequenceDirection: true }),
    ).toEqual(directed);
    expect(SEQUENCE_SEARCH).toEqual({
      depth: 3,
      beamWidth: 6,
      maxCandidates: 6,
    });
    directed.forEach((motion, index) => {
      expect(motion?.decision?.sourceKey).toBe(
        sequenceSourceKey(scenes[index]),
      );
      expect(motion?.decision?.alternatives.length).toBeGreaterThan(0);
    });
    const tooShort = {
      text: "Supplied values",
      chart: { labels: ["Only"], series: [{ label: "Given", values: [1] }] },
      layout: { width: 1080, height: 1920, duration: 0.5 },
    };
    expect(
      planMotionSequence([tooShort], {
        ...settings,
        sequenceDirection: true,
      })[0],
    ).toBeUndefined();
    const locked = {
      ...scenes[0],
      locked: true,
      current: { recipeId: "type-window" as const, version: "1.0.0" as const },
    };
    expect(
      planMotionSequence([locked], { ...settings, sequenceDirection: true })[0],
    ).toEqual(locked.current);
  });
  it.each([
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ])(
    "resolves three films at %s×%s with valid recurring ports and deterministic geometry",
    (width, height) => {
      for (let film = 0; film < 3; film++) {
        const props = sequenceFixture(film, width, height),
          plan = resolveSequenceContinuity(props)!;
        expect(plan.ports.length).toBeGreaterThan(0);
        expect(plan.boundaries.some((b) => b.kind === "shared-card")).toBe(
          true,
        );
        expect(plan.ports.some((p) => p.state === "revisited")).toBe(true);
        expect(resolveSequenceContinuity(props)).toEqual(plan);
        for (const b of plan.boundaries.filter(
          (b) => b.kind === "shared-card",
        )) {
          expect(b.from!.subjectId).toBe(b.to!.subjectId);
          expect(b.startFrame + b.durationFrames).toBeLessThan(1260);
        }
        const html = buildHyperframesCompositionHtml(props);
        for (const scene of props.scenes) expect(html).toContain(scene.text);
        expect(html).toContain('data-card-handoff="1"');
      }
    },
  );
  it("retains the existing transition for locks, gaps, short timing, unmatched subjects and different families", () => {
    const cases = [
      (p: ReturnType<typeof sequenceFixture>) => {
        p.scenes[0].locks = { copy: false, assets: false, scene: true };
      },
      (p: ReturnType<typeof sequenceFixture>) => {
        p.scenes[0].items = ["Unrelated", "Different"];
      },
      (p: ReturnType<typeof sequenceFixture>) => {
        p.scenes[1].motion!.system = "poster";
      },
      (p: ReturnType<typeof sequenceFixture>) => {
        p.timeline[0].durationFrames = 30;
      },
      (p: ReturnType<typeof sequenceFixture>) => {
        p.timeline[1].startFrame++;
      },
    ];
    for (const change of cases) {
      const p = sequenceFixture();
      change(p);
      expect(resolveSequenceContinuity(p)!.boundaries[0].kind).toBe(
        "existing-transition",
      );
    }
    const marked = sequenceFixture();
    marked.scenes[0].locks = { copy: false, assets: false, scene: true };
    expect(
      resolveSequenceContinuity(marked)!.ports.some(
        (p) => p.sceneId === marked.scenes[0].id,
      ),
    ).toBe(true);
    delete marked.scenes[0].motion!.sequenceVersion;
    expect(
      resolveSequenceContinuity(marked)!.ports.some(
        (p) => p.sceneId === marked.scenes[0].id,
      ),
    ).toBe(false);
    const p = sequenceFixture();
    delete p.sequenceDirection;
    expect(resolveSequenceContinuity(p)).toBeUndefined();
    expect(buildHyperframesCompositionHtml(p)).not.toContain(
      'data-card-handoff="1"',
    );
  });
  it("invalidates both endpoint sections for boundary edits while retaining an unrelated later section", () => {
    const p = sequenceFixture();
    // Place a supported boundary exactly at 30 seconds and an unrelated reading scene at 60.
    p.scenes = [
      p.scenes[0],
      p.scenes[1],
      { ...p.scenes.at(-1)!, id: "reading" },
      { ...p.scenes.at(-1)!, id: "unrelated" },
    ];
    p.timeline = p.scenes.map((s, i) => ({
      sceneId: s.id,
      startFrame: i * 900,
      durationFrames: 900,
    }));
    const sections = [0, 1, 2, 3].map((index) => ({
      index,
      startFrame: index * 900,
      endFrame: (index + 1) * 900 - 1,
    }));
    const html = (index: number) =>
      buildHyperframesCompositionHtml(
        sectionVisualProps(p, sections[index], 30),
      );
    const before = sections.map((_, i) => html(i));
    expect(before[0]).toContain(p.scenes[1].text);
    p.scenes[1].items![1] = "Changed endpoint geometry";
    expect(html(0)).not.toBe(before[0]);
    expect(html(1)).not.toBe(before[1]);
    expect(html(3)).toBe(before[3]);
  });
  it("freezes the sequence contract and rejects geometry tampering; prepared exports keep the same direction", () => {
    const fixture = sequenceFixture(),
      snapshot = filmSnapshot();
    snapshot.script.motionPlan = {
      version: "1.0.0",
      seed: "m3",
      ambition: "expressive",
      sequenceDirection: true,
      adaptiveRecipes: true,
      subjectRegistry: fixture.sequenceDirection!.subjects,
    };
    snapshot.script.scenes = fixture.scenes.map((s) => ({
      ...snapshot.script.scenes[0],
      ...s,
      spokenText: null,
      hideText: false,
    }));
    snapshot.take = {
      id: "take",
      scriptId: snapshot.script.id,
      label: null,
      providerId: "placeholder",
      voiceId: "silent",
      modelId: null,
      fps: 30,
      totalFrames: 1260,
      timeline: fixture.timeline.map((beat, index) => ({
        ...beat,
        text: fixture.scenes[index].text,
      })),
      audioUrl: "/silent.wav",
      isPlaceholder: true,
      source: "oneshot",
      createdAt: "2026-10-16T00:00:00Z",
    };
    const plan = withResolvedFilmPlan(snapshot);
    expect(plan.filmPlan!.resolverVersion).toBe("1.2.0");
    expect(
      plan.filmPlan!.sequence?.boundaries.some((b) => b.kind === "shared-card"),
    ).toBe(true);
    expect(filmPlanMatchesSource(plan)).toBe(true);
    plan.filmPlan!.sequence!.ports[0].x++;
    expect(filmPlanMatchesSource(plan)).toBe(false);
    const timing = resolveReelTimeline(
        snapshot.script.scenes,
        snapshot.take,
        30,
      ),
      prepared = prepareVideoComposition(snapshot, timing);
    const wire = preparedVideoCompositionSchema.parse(prepared);
    expect(wire.props.sequenceDirection).toEqual(fixture.sequenceDirection);
  });
});
