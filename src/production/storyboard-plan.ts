/**
 * Maps a validated Storyboard v1 video onto the existing scene plan that the
 * project repository, media resolution and renderer already consume. Pure and
 * deterministic: no database, network or clock.
 *
 * Everything visual that the storyboard does not name (layout, motion, colour,
 * transitions, timing) is decided later by the local director from this plan.
 */
import type { Orientation } from "@/lib/orientation";
import { autoTheme, getTheme } from "@/video/themes";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import type { AIScene, ScenePlan } from "@/providers/ai/types";
import {
  estimateDurationSeconds,
  type Storyboard,
  type VideoStoryboard,
} from "@/storyboard";

type SceneType = VideoStoryboard["scenes"][number]["type"];

/** Scene type to the HyperFrames treatment that renders it today. */
export const STORYBOARD_TEMPLATE_BY_TYPE: Readonly<Record<SceneType, string>> =
  {
    hook: "hf-opener",
    statement: "hf-statement",
    list: "hf-list",
    stat: "hf-stat",
    chart: "hf-data-chart",
    quote: "hf-quote",
    code: "hf-terminal",
    media: "hf-broll",
    cta: "hf-cta",
    "kinetic-text": "hf-kinetic-text",
    steps: "hf-steps",
    comparison: "hf-comparison",
    "before-after": "hf-before-after",
    timeline: "hf-timeline",
    definition: "hf-definition",
    terminal: "hf-terminal",
    diagram: "hf-diagram",
    "media-split": "hf-media-split",
    "device-mockup": "hf-device-mockup",
    checklist: "hf-checklist",
  };

const ORIENTATION_BY_FORMAT: Record<VideoStoryboard["format"], Orientation> = {
  "9:16": "portrait",
  "16:9": "landscape",
  "1:1": "square",
};

/** Scene type to the engine-neutral role the motion director plans from. */
export const STORYBOARD_ROLE_BY_TYPE: Readonly<
  Record<SceneType, ProductionSceneRole>
> = {
  hook: "hook",
  statement: "explanation",
  list: "summary",
  stat: "metric",
  chart: "chart",
  quote: "quote",
  code: "code",
  media: "feature",
  cta: "cta",
  "kinetic-text": "emphasis",
  steps: "explanation",
  comparison: "comparison",
  "before-after": "comparison",
  timeline: "explanation",
  definition: "explanation",
  terminal: "terminal",
  diagram: "diagram",
  "media-split": "feature",
  "device-mockup": "screenshot-demo",
  checklist: "summary",
};

/**
 * The look family for a storyboard, decided only from its content and format:
 * code means a developer demo, charts and stats a data story, a quote or a
 * landscape explainer the editorial look, everything else creator punch.
 */
export function presetForStoryboard(
  storyboard: VideoStoryboard,
): ProductionPresetId {
  const count = (type: SceneType) =>
    storyboard.scenes.filter((s) => s.type === type).length;
  if (count("code") > 0 || count("terminal") > 0) return "developer-demo";
  if (count("chart") > 0 || count("stat") >= 2) return "data-story";
  if (count("quote") > 0 || storyboard.format === "16:9")
    return "editorial-explainer";
  return "creator-punch";
}

export interface StoryboardPlanScene {
  index: number;
  type: SceneType;
  templateId: string;
  headline: string;
  narrationWords: number;
  backgroundQuery?: string;
  assetId?: string;
}

export interface StoryboardProductionPlan {
  scenePlan: ScenePlan;
  presetId: ProductionPresetId;
  roles: ProductionSceneRole[];
  orientation: Orientation;
  music: { mode: "auto" | "none" | "track"; trackId?: string };
  voice: { enabled: boolean; voiceId?: string; speed?: number };
  captions: "auto" | "off";
  sfx: "auto" | "off";
  /** Library asset per scene, when the storyboard named one. */
  assetIds: Array<string | undefined>;
  scenes: StoryboardPlanScene[];
  estimatedSeconds: number;
  /** The theme the video wears: named in the storyboard, or chosen from its words. */
  themeId: string;
  /** Things the storyboard asked for that this release does not apply yet. */
  warnings: string[];
}

export function planFromStoryboard(
  storyboard: Storyboard,
  options: { knownTrackIds?: readonly string[] } = {},
): StoryboardProductionPlan {
  if (storyboard.kind !== "video") {
    throw new Error("Only video storyboards can be planned as scenes");
  }
  const warnings: string[] = [];
  const assetIds: Array<string | undefined> = [];
  const planScenes: StoryboardPlanScene[] = [];

  const scenes: AIScene[] = storyboard.scenes.map((scene, index) => {
    const templateId = STORYBOARD_TEMPLATE_BY_TYPE[scene.type];
    const spoken = scene.narration.trim();
    let text = scene.headline;
    let visual: string | undefined;
    let backgroundQuery: string | undefined;
    let assetId: string | undefined;
    let panel: Record<string, unknown> | undefined;

    switch (scene.type) {
      case "stat":
        visual = scene.stat?.value;
        break;
      case "quote":
        text = scene.quote?.text ?? scene.headline;
        visual = scene.quote?.attribution;
        break;
      case "code":
        panel = {
          lines: (scene.code?.text ?? "").split("\n").slice(0, 12),
        };
        break;
      case "cta":
        visual = scene.body;
        break;
      case "steps":
      case "checklist":
        panel = { items: scene.items };
        break;
      case "comparison":
      case "before-after":
        panel = { left: scene.compare?.left, right: scene.compare?.right };
        break;
      case "timeline":
      case "diagram":
        panel = { points: scene.points };
        break;
      case "definition":
        panel = {
          term: scene.definition?.term,
          meaning: scene.definition?.meaning,
        };
        break;
      case "terminal":
        panel = { lines: (scene.code?.text ?? "").split("\n").slice(0, 12) };
        break;
      case "kinetic-text":
        panel = {};
        break;
      case "media-split":
      case "device-mockup":
        panel =
          scene.type === "media-split"
            ? { caption: scene.body }
            : { screen: scene.body };
        backgroundQuery = scene.media?.query;
        assetId = scene.media?.assetId;
        if (scene.media?.path) {
          warnings.push(
            `scenes.${index}: media paths are not applied yet; the headline is used as the search query`,
          );
          backgroundQuery = scene.headline.slice(0, 80);
        }
        if (!backgroundQuery && !assetId && scene.type === "media-split")
          backgroundQuery = scene.headline.slice(0, 80);
        break;
      case "media":
        backgroundQuery = scene.media?.query;
        assetId = scene.media?.assetId;
        if (scene.media?.path) {
          warnings.push(
            `scenes.${index}: media paths are not applied yet; the headline is used as the search query`,
          );
          backgroundQuery = scene.headline.slice(0, 80);
        }
        if (!backgroundQuery && !assetId)
          backgroundQuery = scene.headline.slice(0, 80);
        break;
      default:
        break;
    }
    if (
      scene.body &&
      !["cta", "media-split", "device-mockup"].includes(scene.type)
    ) {
      warnings.push(`scenes.${index}: body is not shown yet`);
    }
    if (scene.icon) panel = { ...panel, icon: scene.icon };
    panel = { ...panel, sceneType: scene.type };
    assetIds.push(assetId);
    planScenes.push({
      index,
      type: scene.type,
      templateId,
      headline: scene.headline,
      narrationWords: spoken.split(/\s+/).filter(Boolean).length,
      ...(backgroundQuery ? { backgroundQuery } : {}),
      ...(assetId ? { assetId } : {}),
    });
    return {
      text,
      spokenText: spoken !== text.trim() ? spoken : undefined,
      templateId: templateId as AIScene["templateId"],
      emphasis: scene.emphasis ?? [],
      visual,
      items: scene.type === "list" ? scene.items : undefined,
      panel,
      chart:
        scene.type === "chart" && scene.chart
          ? {
              labels: scene.chart.labels,
              series: scene.chart.series,
              ...(scene.chart.source
                ? { sourceAttribution: scene.chart.source }
                : {}),
              ...(scene.chart.kind ? { kind: scene.chart.kind } : {}),
            }
          : undefined,
      backgroundQuery,
    } as AIScene;
  });

  let music: StoryboardProductionPlan["music"] = { mode: "auto" };
  if (storyboard.music === "none") music = { mode: "none" };
  else if (storyboard.music !== "auto") {
    if (options.knownTrackIds?.includes(storyboard.music)) {
      music = { mode: "track", trackId: storyboard.music };
    } else {
      warnings.push(
        `music: unknown track "${storyboard.music}"; chose one automatically`,
      );
    }
  }
  if (storyboard.voice?.speed !== undefined) {
    warnings.push(
      "voice.speed is not applied yet; the voice speaks at its natural speed",
    );
  }
  const presetId = presetForStoryboard(storyboard);
  const named = getTheme(storyboard.theme);
  const themeId = (
    named ??
    autoTheme(
      [
        storyboard.title,
        ...storyboard.scenes.flatMap((s) => [s.headline, s.narration]),
      ].join(" "),
      presetId,
    )
  ).id;

  return {
    scenePlan: {
      projectName: storyboard.title,
      scriptName: storyboard.title,
      scenes,
    },
    presetId,
    themeId,
    roles: storyboard.scenes.map(
      (scene) => STORYBOARD_ROLE_BY_TYPE[scene.type],
    ),
    orientation: ORIENTATION_BY_FORMAT[storyboard.format],
    music,
    voice: {
      enabled: storyboard.voice?.enabled ?? true,
      voiceId: storyboard.voice?.voiceId,
      speed: storyboard.voice?.speed,
    },
    captions: storyboard.captions,
    sfx: storyboard.sfx ?? "auto",
    assetIds,
    scenes: planScenes,
    estimatedSeconds: estimateDurationSeconds(storyboard),
    warnings,
  };
}
