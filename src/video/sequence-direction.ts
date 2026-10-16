import { z } from "zod";
import { GRAPHIC_SYMBOLS } from "./semantic-graphic";

export const subjectSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    label: z.string().trim().min(1).max(96),
    aliases: z.array(z.string().trim().min(1).max(96)).max(12),
    symbol: z.enum(GRAPHIC_SYMBOLS),
    colorSlot: z.enum(["accent", "accentSecondary", "foreground"]),
  })
  .strict();
export const subjectKey = (label: string) =>
  label.normalize("NFC").replace(/\s+/g, " ").trim();
export const subjectRegistrySchema = z
  .array(subjectSchema)
  .max(2048)
  .superRefine((subjects, ctx) => {
    const ids = new Set<string>(),
      labels = new Map<string, string>();
    for (const [index, subject] of subjects.entries()) {
      if (ids.has(subject.id))
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Duplicate subject ID",
        });
      ids.add(subject.id);
      for (const label of [subject.label, ...subject.aliases]) {
        const key = subjectKey(label),
          owner = labels.get(key);
        if (owner && owner !== subject.id)
          ctx.addIssue({
            code: "custom",
            path: [index, "aliases"],
            message: "Ambiguous subject label or alias",
          });
        labels.set(key, subject.id);
      }
    }
  });
export type Subject = z.infer<typeof subjectSchema>;
export const sequenceConfigSchema = z
  .object({ version: z.literal(1), subjects: subjectRegistrySchema })
  .strict();
export type SequenceConfig = z.infer<typeof sequenceConfigSchema>;
/** Shared by editor, captured preparation, native fallback and immutable specs. */
export function sequenceConfigFor(plan?: {
  sequenceDirection?: boolean;
  subjectRegistry?: Subject[];
}): SequenceConfig | undefined {
  return plan?.sequenceDirection
    ? { version: 1, subjects: plan.subjectRegistry ?? [] }
    : undefined;
}
export const visualProfileSchema = z
  .object({
    silhouette: z.enum([
      "focus",
      "reading",
      "panels",
      "route",
      "evidence",
      "media",
      "other",
    ]),
    movement: z.enum(["hold", "rise", "draw", "zoom"]),
    density: z.enum(["low", "medium", "high"]),
    subjects: z.number().int().min(0).max(100),
  })
  .strict();
export type VisualProfile = z.infer<typeof visualProfileSchema>;
const portSchema = z
  .object({
    sceneId: z.string().min(1),
    subjectId: z.string().min(1),
    index: z.number().int().min(0).max(5),
    label: z.string().min(1).max(96),
    state: z.enum(["introduced", "revisited"]),
    flow: z.enum(["row", "column"]),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
    fontSize: z.number().positive(),
  })
  .strict();
export const resolvedSequenceSchema = z
  .object({
    version: z.literal(1),
    adapter: z.literal("adaptive-panel-handoff@1.0.0"),
    subjects: subjectRegistrySchema,
    ports: z.array(portSchema).max(1440),
    boundaries: z
      .array(
        z
          .object({
            fromSceneId: z.string().min(1),
            toSceneId: z.string().min(1),
            kind: z.enum(["shared-card", "existing-transition"]),
            reason: z.string().min(1).max(500),
            startFrame: z.number().int().nonnegative(),
            durationFrames: z.number().int().positive(),
            subjectId: z.string().optional(),
            from: portSchema.optional(),
            to: portSchema.optional(),
            system: z.enum(["editorial", "precision", "poster"]).optional(),
          })
          .strict(),
      )
      .max(239),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const ids = new Set(plan.subjects.map((s) => s.id));
    for (const port of plan.ports)
      if (!ids.has(port.subjectId))
        ctx.addIssue({ code: "custom", message: "Unknown port subject" });
    for (const b of plan.boundaries)
      if (
        b.kind === "shared-card" &&
        (!b.from ||
          !b.to ||
          !b.system ||
          b.from.subjectId !== b.subjectId ||
          b.to.subjectId !== b.subjectId ||
          b.from.sceneId !== b.fromSceneId ||
          b.to.sceneId !== b.toSceneId)
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid shared-card boundary",
        });
  });
export type ResolvedSequence = z.infer<typeof resolvedSequenceSchema>;
