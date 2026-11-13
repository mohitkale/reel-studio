// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ScriptDTO } from "@/lib/dto";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { planFromStoryboard } from "@/production/storyboard-plan";
import { lintStoryboard, type Storyboard } from "@/storyboard";
import { MUSIC_LIBRARY } from "@/lib/music-library";

import {
  buildStoryboardSource,
  scriptToStoryboard,
  sceneFingerprint,
} from "./project-storyboard";

const dir = path.resolve(__dirname, "..", "..", "examples", "storyboards");
const golden = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
const load = (name: string) =>
  lintStoryboard(readFileSync(path.join(dir, `${name}.json`), "utf8"))
    .storyboard as Storyboard;

/** What persistence stores for a storyboard project, without a database. */
function project(storyboard: Extract<Storyboard, { kind: "video" }>) {
  const plan = planFromStoryboard(storyboard);
  const scenes = enrichScenePlan(plan.scenePlan.scenes, "hyperframes");
  const dto = {
    id: "s1",
    projectId: "p1",
    name: storyboard.title,
    width:
      plan.orientation === "landscape"
        ? 1920
        : plan.orientation === "square"
          ? 1080
          : 1080,
    height:
      plan.orientation === "landscape"
        ? 1080
        : plan.orientation === "square"
          ? 1080
          : 1920,
    musicUrl: plan.music.mode === "none" ? null : MUSIC_LIBRARY[0]!.url,
    scenes: scenes.map((scene, order) => ({
      id: `scene-${order}`,
      scriptId: "s1",
      order,
      templateId: scene.templateId,
      text: scene.text,
      spokenText: scene.spokenText ?? null,
      emphasis: scene.emphasis ?? [],
      visual: scene.visual,
      items: scene.items,
      chart: scene.chart,
      hideText: null,
      selectedVoiceClipId: null,
    })),
  } as unknown as ScriptDTO;
  return { dto, source: buildStoryboardSource(storyboard, dto.scenes) };
}

/** The fields a project can hold, so storyboard -> project -> storyboard can be compared. */
function normalize(storyboard: Extract<Storyboard, { kind: "video" }>) {
  return {
    title: storyboard.title,
    format: storyboard.format,
    captions: storyboard.captions,
    sources: storyboard.sources ?? null,
    scenes: storyboard.scenes.map((s) => ({
      type: s.type,
      headline: s.headline,
      narration: s.narration,
      body: s.body ?? null,
      items: s.items ?? null,
      stat: s.stat ?? null,
      chart: s.chart ?? null,
      quote: s.quote ?? null,
      code: s.code?.text ?? null,
      icon: s.icon ?? null,
      emphasis: s.emphasis ?? null,
    })),
  };
}

describe("storyboard -> project -> storyboard", () => {
  const videos = golden.filter((name) => load(name).kind === "video");

  it("covers eleven golden videos (the podcast is not a project)", () => {
    expect(videos).toHaveLength(11);
  });

  it.each(videos)("%s round trips after normalisation", (name) => {
    const original = load(name) as Extract<Storyboard, { kind: "video" }>;
    const { dto, source } = project(original);
    const exported = scriptToStoryboard({ ...dto, storyboardSource: source });
    expect(exported.errors).toEqual([]);
    const back = exported.storyboard as Extract<Storyboard, { kind: "video" }>;
    expect(normalize(back)).toEqual(normalize(original));
    expect(exported.notes.filter((n) => !/music|code scenes/.test(n))).toEqual(
      [],
    );
  });
});

describe("projects without a sidecar", () => {
  const scene = (
    templateId: string,
    text: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id: text,
    scriptId: "s",
    order: 0,
    templateId,
    text,
    spokenText: null,
    emphasis: [],
    hideText: null,
    selectedVoiceClipId: null,
    ...extra,
  });
  const script = (scenes: unknown[], extra: Record<string, unknown> = {}) =>
    ({
      id: "s",
      projectId: "p",
      name: "Legacy",
      width: 1080,
      height: 1920,
      musicUrl: null,
      ...extra,
      scenes,
    }) as unknown as ScriptDTO;

  it("maps legacy and catalog templates onto the v1 scene types", () => {
    const result = scriptToStoryboard(
      script([
        scene("kinetic", "Open strong"),
        scene("icon-grid", "Three tips", { items: ["One", "Two", "Three"] }),
        scene("stat-reveal", "Teams ship twice as fast", { visual: "2×" }),
        scene("quote-card", "Plain words matter.", { visual: "A. Writer" }),
        scene("hf-kinetic-slam", "Slam it home"),
        scene("hf-cta", "Follow along"),
      ]),
    );
    expect(result.errors).toEqual([]);
    const types =
      result.storyboard!.kind === "video"
        ? result.storyboard!.scenes.map((s) => s.type)
        : [];
    expect(types).toEqual([
      "hook",
      "list",
      "stat",
      "quote",
      "statement",
      "cta",
    ]);
    expect(result.notes.join(" ")).toContain("hf-kinetic-slam");
    expect(result.storyboard).toMatchObject({ format: "9:16", music: "none" });
  });

  it("exports the narration the voice speaks, and the format from the canvas", () => {
    const result = scriptToStoryboard(
      script(
        [
          scene("hf-statement", "Short", {
            spokenText: "A longer spoken line for the voice.",
          }),
        ],
        { width: 1920, height: 1080 },
      ),
    );
    expect(result.storyboard).toMatchObject({
      format: "16:9",
      scenes: [
        { headline: "Short", narration: "A longer spoken line for the voice." },
      ],
    });
  });

  it("turns a quote without attribution or a stat without a value into a statement, with a note", () => {
    const result = scriptToStoryboard(
      script([
        scene("hf-quote", "Words with no speaker"),
        scene("hf-stat", "No number here"),
      ]),
    );
    const types =
      result.storyboard!.kind === "video"
        ? result.storyboard!.scenes.map((s) => s.type)
        : [];
    expect(types).toEqual(["statement", "statement"]);
    expect(result.notes.length).toBeGreaterThanOrEqual(2);
  });

  it("turns a chart scene with no usable data into a statement, with a note", () => {
    const result = scriptToStoryboard(
      script([
        scene("hf-data-chart", "Revenue by month"),
        scene("hf-data-chart", "Too wide", {
          chart: {
            labels: ["a", "b", "c", "d", "e", "f", "g"],
            series: [{ label: "s", values: [1, 2, 3, 4, 5, 6, 7] }],
          },
        }),
      ]),
    );
    expect(result.errors).toEqual([]);
    const types =
      result.storyboard!.kind === "video"
        ? result.storyboard!.scenes.map((s) => s.type)
        : [];
    expect(types).toEqual(["statement", "statement"]);
    expect(result.notes.filter((n) => n.includes("chart")).length).toBe(2);
  });

  it("exports a valid storyboard for every preset sample scene set", () => {
    const fixtures = path.resolve(__dirname, "..", "..", "tests", "fixtures");
    for (const file of readdirSync(fixtures).filter((f) =>
      /-reel\.json$/.test(f),
    )) {
      const reel = JSON.parse(
        readFileSync(path.join(fixtures, file), "utf8"),
      ) as {
        scenes: Array<Record<string, unknown>>;
        width?: number;
        height?: number;
      };
      const result = scriptToStoryboard(
        script(
          reel.scenes.map((s, i) => ({
            ...scene(
              String(s.templateId ?? "hf-statement"),
              String(s.text ?? `Scene ${i + 1}`),
            ),
            ...s,
            spokenText: (s.spokenText as string | undefined) ?? null,
          })),
          { width: reel.width ?? 1080, height: reel.height ?? 1920 },
        ),
      );
      expect(result.errors, file).toEqual([]);
      expect(result.storyboard, file).not.toBeNull();
    }
  });
});

describe("edits made after the storyboard was written", () => {
  it("win over the saved extras, which are dropped with a note", () => {
    const original = load("data-story") as Extract<
      Storyboard,
      { kind: "video" }
    >;
    const { dto, source } = project(original);
    const edited = {
      ...dto,
      scenes: dto.scenes.map((s, i) =>
        i === 2 ? { ...s, text: `${s.text} (edited)` } : s,
      ),
    } as ScriptDTO;
    const result = scriptToStoryboard({ ...edited, storyboardSource: source });
    const stat =
      result.storyboard!.kind === "video"
        ? result.storyboard!.scenes[2]!
        : null;
    expect(stat?.headline).toContain("(edited)");
    expect(result.notes.join(" ")).toContain("edited");
  });

  it("fingerprints the copy, not the order", () => {
    expect(sceneFingerprint("A", "B")).toBe(sceneFingerprint(" A ", " B "));
    expect(sceneFingerprint("A", null)).not.toBe(sceneFingerprint("A", "B"));
  });
});
