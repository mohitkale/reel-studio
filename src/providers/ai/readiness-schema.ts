import { z } from "zod";

export const generationProbeSchema = z.object({
  modelId: z.string().max(256),
  checkedAt: z.string().datetime({ offset: true }),
  latencyMs: z.number().nonnegative(),
  language: z.enum(["English", "Hindi", "Hinglish"]),
  structuredOutput: z.boolean(),
});
export type GenerationProbe = z.infer<typeof generationProbeSchema>;
