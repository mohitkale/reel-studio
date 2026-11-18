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
