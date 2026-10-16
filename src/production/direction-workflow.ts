import { z } from "zod";

export const directionWorkflowSchema = z
  .object({
    preview: z.boolean().optional(),
    expectedHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    variationSeed: z.string().min(1).max(160).optional(),
    sceneIds: z.array(z.string().min(1).max(160)).min(1).max(240).optional(),
    undo: z.boolean().optional(),
  })
  .strict();
export type DirectionWorkflow = z.infer<typeof directionWorkflowSchema>;
export interface DirectionProposal {
  state: "planned";
  sourceHash: string;
  settings: { seed: string };
  changedSceneIds: string[];
  protectedSceneCount: number;
  changes: Array<{
    sceneId: string;
    before: string;
    after: string;
    beforeSystem?: string;
    afterSystem?: string;
  }>;
}
