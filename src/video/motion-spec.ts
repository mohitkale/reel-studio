import { z } from "zod";
import type { ReelBeat, ReelProps, ReelScene } from "./types";

export const MOTION_SPEC_VERSION = 1 as const;
const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\w-]+$/);
const frame = z.number().int().nonnegative();
const color = z.enum([
  "background",
  "foreground",
  "accent",
  "accentSecondary",
  "muted",
]);
const keyframeSchema = z
  .object({
    frame,
    value: z.number().finite().min(-10000).max(10000),
    ease: z.enum(["linear", "in", "out", "in-out"]).default("linear"),
  })
  .strict();
const trackSchema = z
  .object({
    property: z.enum(["x", "y", "scale", "rotation", "opacity"]),
    keyframes: z.array(keyframeSchema).min(1).max(64),
  })
  .strict();
const boxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (box) => box.x + box.width <= 1.000001 && box.y + box.height <= 1.000001,
    "Element must fit the canvas",
  );
export const motionElementSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("legacy-scene"), sceneId: id }).strict(),
  z
    .object({
      id,
      kind: z.literal("text"),
      text: z.string().min(1).max(1000),
      box: boxSchema,
      color,
      fontSize: z.number().min(8).max(240),
      align: z.enum(["left", "center", "right"]),
      tracks: z.array(trackSchema).max(5),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("shape"),
      shape: z.enum(["rectangle", "ellipse"]),
      box: boxSchema,
      color,
      tracks: z.array(trackSchema).max(5),
    })
    .strict(),
]);
export const motionSpecSchema = z
  .object({
    version: z.literal(MOTION_SPEC_VERSION),
    fps: z.number().int().min(1).max(120),
    shots: z
      .array(
        z
          .object({
            id,
            startFrame: frame,
            durationFrames: z.number().int().positive(),
            layers: z
              .array(
                z
                  .object({
                    id,
                    order: z.number().int().min(0).max(100),
                    elements: z.array(motionElementSchema).min(1).max(32),
                  })
                  .strict(),
              )
              .min(1)
              .max(16),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    const unique = (value: string) => {
      if (ids.has(value))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate motion ID: ${value}`,
        });
      ids.add(value);
    };
    let end = 0;
    for (const shot of spec.shots) {
      unique(shot.id);
      if (shot.startFrame < end)
        ctx.addIssue({
          code: "custom",
          message: "Shots must be ordered and may not overlap",
        });
      end = shot.startFrame + shot.durationFrames;
      const elements = shot.layers.flatMap((layer) => layer.elements);
      if (
        elements.some((element) => element.kind === "legacy-scene") &&
        elements.length !== 1
      )
        ctx.addIssue({
          code: "custom",
          message: "Legacy shots must contain exactly one scene reference",
        });
      const orders = new Set<number>();
      for (const layer of shot.layers) {
        unique(layer.id);
        if (orders.has(layer.order))
          ctx.addIssue({
            code: "custom",
            message: "Layer orders must be unique within a shot",
          });
        orders.add(layer.order);
        for (const element of layer.elements) {
          unique(element.id);
          if (element.kind === "legacy-scene") continue;
          const properties = new Set<string>();
          for (const track of element.tracks) {
            if (properties.has(track.property))
              ctx.addIssue({
                code: "custom",
                message: "Only one track per property is allowed",
              });
            properties.add(track.property);
            let previous = -1;
            for (const key of track.keyframes) {
              if (key.frame <= previous || key.frame > shot.durationFrames)
                ctx.addIssue({
                  code: "custom",
                  message: "Keyframes must increase within the shot",
                });
              if (
                track.property === "opacity" &&
                (key.value < 0 || key.value > 1)
              )
                ctx.addIssue({
                  code: "custom",
                  message: "Opacity must be between zero and one",
                });
              if (
                track.property === "scale" &&
                (key.value <= 0 || key.value > 10)
              )
                ctx.addIssue({
                  code: "custom",
                  message: "Scale must be positive and at most ten",
                });
              previous = key.frame;
            }
          }
        }
      }
    }
  });
export type MotionSpec = z.infer<typeof motionSpecSchema>;
export type MotionShot = MotionSpec["shots"][number];

/** References retain the complete scene contract; no destructive DB rewrite. */
export function migrateLegacyMotion(
  props: Pick<ReelProps, "scenes" | "timeline" | "fps">,
): MotionSpec {
  const reserved = new Set(props.timeline.map((beat) => beat.sceneId));
  const allocate = (base: string) => {
    let candidate = base;
    while (reserved.has(candidate)) candidate = `_${candidate}`;
    reserved.add(candidate);
    return candidate;
  };
  for (const beat of props.timeline) {
    if (!props.scenes.some((scene) => scene.id === beat.sceneId))
      throw new Error(`Missing legacy source scene: ${beat.sceneId}`);
  }
  return motionSpecSchema.parse({
    version: 1,
    fps: props.fps,
    shots: props.timeline.map((beat, index) => ({
      id: beat.sceneId,
      startFrame: beat.startFrame,
      durationFrames: beat.durationFrames,
      layers: [
        {
          id: allocate(`legacy-layer-${index}`),
          order: 0,
          elements: [
            {
              id: allocate(`legacy-element-${index}`),
              kind: "legacy-scene",
              sceneId: beat.sceneId,
            },
          ],
        },
      ],
    })),
  });
}

export function legacyMotionRoundTrip(
  input: MotionSpec,
  scenes: ReelScene[],
): { scenes: ReelScene[]; timeline: ReelBeat[] } {
  const spec = motionSpecSchema.parse(input);
  const restored = spec.shots.map((shot) => {
    const elements = shot.layers.flatMap((layer) => layer.elements);
    const element = elements[0];
    if (
      elements.length !== 1 ||
      element.kind !== "legacy-scene" ||
      element.sceneId !== shot.id
    )
      throw new Error(
        "Authored graph shots cannot be converted to legacy scenes",
      );
    const source = scenes.find((scene) => scene.id === element.sceneId);
    if (!source)
      throw new Error(`Missing legacy source scene: ${element.sceneId}`);
    return structuredClone(source);
  });
  return {
    scenes: restored,
    timeline: spec.shots.map((shot) => ({
      sceneId: shot.id,
      startFrame: shot.startFrame,
      durationFrames: shot.durationFrames,
    })),
  };
}

/** A graph changes visuals, while existing audio/caption timing stays authoritative. */
export function validateMotionForReel(
  props: ReelProps,
): MotionSpec | undefined {
  if (!props.motionSpec) return undefined;
  const spec = motionSpecSchema.parse(props.motionSpec);
  if (spec.fps !== props.fps || spec.shots.length !== props.timeline.length)
    throw new Error("Motion spec must match reel timing");
  spec.shots.forEach((shot, index) => {
    const beat = props.timeline[index];
    if (
      shot.id !== beat.sceneId ||
      shot.startFrame !== beat.startFrame ||
      shot.durationFrames !== beat.durationFrames ||
      !props.scenes.some((scene) => scene.id === shot.id)
    )
      throw new Error("Motion shot must match its existing scene and beat");
    const legacy = shot.layers
      .flatMap((layer) => layer.elements)
      .find((element) => element.kind === "legacy-scene");
    if (legacy && legacy.sceneId !== shot.id)
      throw new Error("Legacy scene reference must match its shot");
  });
  return spec;
}
