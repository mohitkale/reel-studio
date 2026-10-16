import { coverFrames, type ReelProps } from "@/video/types";
import {
  resolvedSequenceSchema,
  type ResolvedSequence,
} from "@/video/sequence-direction";
import { resolveAdaptiveLayout } from "./adaptive-layout";
import {
  collectSequenceSubjects,
  findSequenceSubject,
} from "./sequence-subjects";

/** A composition-level v1 adapter. M2's pinned recipe manifests remain unchanged. */
export function resolveSequenceContinuity(
  props: ReelProps,
): ResolvedSequence | undefined {
  if (!props.sequenceDirection) return;
  const subjects = collectSequenceSubjects(
    props.scenes,
    props.sequenceDirection.subjects,
  );
  const fps = props.fps ?? 30,
    cover = coverFrames(fps, Boolean(props.coverUrl));
  const scenes = new Map(props.scenes.map((s) => [s.id, s]));
  const ports: ResolvedSequence["ports"] = [],
    seen = new Set<string>();
  for (const beat of props.timeline) {
    const scene = scenes.get(beat.sceneId);
    if (!scene) continue;
    if (
      !["adaptive-comparison", "adaptive-process"].includes(
        scene.motion?.recipeId ?? "",
      ) ||
      (scene.locks?.scene && scene.motion?.sequenceVersion !== 1) ||
      scene.hideText
    )
      continue;
    const { plan } = resolveAdaptiveLayout(
      scene,
      props.width ?? 1080,
      props.height ?? 1920,
      beat.durationFrames / fps,
    );
    if (!plan) continue;
    for (const panel of plan.panels) {
      const label = scene.items![panel.index],
        subject = findSequenceSubject(subjects, label)!;
      ports.push({
        sceneId: scene.id,
        subjectId: subject.id,
        index: panel.index,
        label,
        state: seen.has(subject.id) ? "revisited" : "introduced",
        flow: plan.variant === "stack" ? "row" : "column",
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        fontSize: panel.fontSize,
      });
      seen.add(subject.id);
    }
  }
  const boundaries: ResolvedSequence["boundaries"] = [];
  for (let i = 1; i < props.timeline.length; i++) {
    const prior = props.timeline[i - 1],
      next = props.timeline[i],
      fromScene = scenes.get(prior.sceneId),
      toScene = scenes.get(next.sceneId);
    if (!fromScene || !toScene) continue;
    const fromPorts = ports.filter((p) => p.sceneId === prior.sceneId),
      toPorts = ports.filter((p) => p.sceneId === next.sceneId);
    const pair = fromPorts
      .map((from) => ({
        from,
        to: toPorts.find((p) => p.subjectId === from.subjectId),
      }))
      .find((p) => p.to);
    let reason =
      "No shared subject in compatible adaptive panels; retain the existing transition.";
    if (fromScene.locks?.scene || toScene.locks?.scene)
      reason = "A scene is locked; retain its existing transition.";
    else if (fromScene.motion?.system !== toScene.motion?.system)
      reason = "Visual families differ; retain the existing transition.";
    else if (prior.durationFrames < fps * 3 || next.durationFrames < fps * 3)
      reason = "The reading window is too short for a card handoff.";
    else if (next.startFrame !== prior.startFrame + prior.durationFrames)
      reason = "A timing gap or overlap retains the existing transition.";
    else if (pair?.to && pair.from.flow !== pair.to.flow)
      reason = "Card text arrangements differ; retain the existing transition.";
    else if (pair?.to) {
      boundaries.push({
        fromSceneId: prior.sceneId,
        toSceneId: next.sceneId,
        kind: "shared-card",
        reason: `Carry ${pair.from.label} with its saved identity and color.`,
        startFrame: cover + next.startFrame - Math.round(fps * 0.25),
        durationFrames: Math.round(fps * 0.6),
        subjectId: pair.from.subjectId,
        from: pair.from,
        to: pair.to,
        system: fromScene.motion?.system ?? "precision",
      });
      continue;
    }
    boundaries.push({
      fromSceneId: prior.sceneId,
      toSceneId: next.sceneId,
      kind: "existing-transition",
      reason,
      startFrame: cover + next.startFrame,
      durationFrames: Math.max(1, Math.round(fps * 0.25)),
    });
  }
  const used = new Set(ports.map((p) => p.subjectId));
  return resolvedSequenceSchema.parse({
    version: 1,
    adapter: "adaptive-panel-handoff@1.0.0",
    subjects: subjects.filter((s) => used.has(s.id)),
    ports,
    boundaries,
  });
}
