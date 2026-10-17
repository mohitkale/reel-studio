import { z } from "zod";
export const factoryLineageSchema = z
  .object({
    version: z.literal(1),
    sourceRevisionId: z.string().min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    packDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    profileDigest: z.string().optional(),
    kind: z.enum(["aspect", "cutdown"]),
    sceneIds: z.array(z.string().min(1)).min(1).max(240),
  })
  .strict();
