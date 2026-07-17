import {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  normalizeTemplateId as normalizeRemotionTemplateId,
} from "@/compositions/templates";
import type { VideoEngine } from "@/engines/types";
import { VIDEO_ENGINE_DESCRIPTIONS, VIDEO_ENGINE_LABELS } from "@/engines/types";

/** Remotion adapter — wraps the existing template catalog and composition stack. */
export const remotionEngine: VideoEngine = {
  id: "remotion",
  label: VIDEO_ENGINE_LABELS.remotion,
  description: VIDEO_ENGINE_DESCRIPTIONS.remotion,
  defaultTemplateId: DEFAULT_TEMPLATE_ID,
  listTemplates: () => TEMPLATES,
  normalizeTemplateId: normalizeRemotionTemplateId,
};
