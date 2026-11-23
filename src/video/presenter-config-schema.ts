import { z } from "zod";

import {
  PRESENTER_CHARACTER_IDS,
  VIDEO_PRESENTER_PLACEMENTS,
} from "./presenter-config";

export const presenterConfigSchema = z.object({
  character: z.enum(PRESENTER_CHARACTER_IDS),
  placement: z.enum(VIDEO_PRESENTER_PLACEMENTS),
  off: z.array(z.number().int().min(0).max(500)).max(500).optional(),
});

export const presenterAdjustmentSchema = z.strictObject({
  horizontal: z.number().min(-50).max(50),
  vertical: z.number().min(-50).max(50),
  scale: z.number().min(50).max(150),
});
