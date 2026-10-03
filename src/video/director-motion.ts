import {
  migrateLegacyMotion,
  motionSpecSchema,
  type MotionSpec,
} from "./motion-spec";
import type { ReelProps } from "./types";

/** Materialize frozen shot intent against CURRENT voice/beat timing. The graph
 * stays neutral and seek-safe; changing FPS/takes never replays planning. */
export function compileDirectorMotion(
  props: ReelProps,
): MotionSpec | undefined {
  if (
    !props.scenes.some(
      (scene) => scene.direction?.composition === "layered-title",
    )
  )
    return undefined;
  const spec = migrateLegacyMotion({ ...props, fps: props.fps ?? 30 });
  const reserved = new Set(
    spec.shots.flatMap((shot) => [
      shot.id,
      ...shot.layers.flatMap((layer) => [
        layer.id,
        ...layer.elements.map((element) => element.id),
      ]),
    ]),
  );
  const allocate = (base: string) => {
    while (reserved.has(base)) base = `_${base}`;
    reserved.add(base);
    return base;
  };
  for (const shot of spec.shots) {
    const scene = props.scenes.find((value) => value.id === shot.id)!;
    if (
      scene.direction?.composition !== "layered-title" ||
      scene.hideText ||
      scene.background ||
      scene.visual ||
      scene.items?.length ||
      scene.chart ||
      !scene.text.trim() ||
      scene.text.length > 240
    )
      continue;
    const firstWord = props.spokenWords?.find(
      (word) =>
        word.startFrame >= shot.startFrame &&
        word.startFrame < shot.startFrame + shot.durationFrames,
    );
    const entrance = Math.min(
      shot.durationFrames - 1,
      Math.max(0, (firstWord?.startFrame ?? shot.startFrame) - shot.startFrame),
    );
    const settle = Math.min(
      shot.durationFrames,
      entrance + Math.max(1, Math.round(spec.fps * 0.35)),
    );
    const keyframes =
      entrance > 0
        ? [
            { frame: 0, value: 0, ease: "linear" as const },
            { frame: entrance, value: 0, ease: "linear" as const },
          ]
        : [{ frame: 0, value: 0, ease: "linear" as const }];
    shot.layers = [
      {
        id: allocate(`director-layer-${shot.id}`),
        order: 0,
        elements: [
          {
            id: allocate(`director-accent-${shot.id}`),
            kind: "shape",
            shape: "rectangle",
            color: "accent",
            box: { x: 0.1, y: 0.25, width: 0.12, height: 0.008 },
            tracks: [],
          },
          {
            id: allocate(`director-copy-${shot.id}`),
            kind: "text",
            text: scene.text,
            box: { x: 0.1, y: 0.3, width: 0.8, height: 0.4 },
            color: "foreground",
            align: "left",
            fontSize: Math.max(
              8,
              Math.min(
                240,
                Math.min(props.width ?? 1080, props.height ?? 1920) * 0.09,
              ),
            ),
            tracks: [
              {
                property: "opacity",
                keyframes: [
                  ...keyframes,
                  { frame: settle, value: 1, ease: "out" },
                ],
              },
            ],
          },
        ],
      },
    ];
  }
  return motionSpecSchema.parse(spec);
}
