import { z } from "zod";
import { sfxCueSchema } from "@/lib/sfx-cues";

export const sfxCueEditRequestSchema = z
  .object({
    index: z.number().int().min(0).max(1000),
    expected: sfxCueSchema,
    action: z.enum(["edit", "automatic"]),
    changes: z
      .object({
        sfxId: sfxCueSchema.shape.sfxId.optional(),
        volume: z.number().finite().min(0).max(1).optional(),
        offsetSeconds: z.number().finite().min(-2).max(120).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.action === "edit"
        ? Boolean(input.changes && Object.keys(input.changes).length)
        : input.changes === undefined,
    { message: "Provide cue changes only for an edit" },
  );
export type SfxCueEditRequest = z.infer<typeof sfxCueEditRequestSchema>;
