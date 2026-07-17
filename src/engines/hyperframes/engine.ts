import type { VideoEngine } from "@/engines/types";
import { VIDEO_ENGINE_DESCRIPTIONS, VIDEO_ENGINE_LABELS } from "@/engines/types";
import {
  HF_DEFAULT_TEMPLATE_ID,
  HF_TEMPLATES,
  normalizeHfTemplateId,
} from "@/engines/hyperframes/templates";

/** HyperFrames adapter — HTML-native templates and (later) player/render. */
export const hyperframesEngine: VideoEngine = {
  id: "hyperframes",
  label: VIDEO_ENGINE_LABELS.hyperframes,
  description: VIDEO_ENGINE_DESCRIPTIONS.hyperframes,
  defaultTemplateId: HF_DEFAULT_TEMPLATE_ID,
  listTemplates: () => HF_TEMPLATES,
  normalizeTemplateId: normalizeHfTemplateId,
};
