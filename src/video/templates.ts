/**
 * Template metadata (plain, framework-independent data) so client UI like the scene
 * inspector can list templates without pulling in the heavy video engine. The
 * HyperFrames catalog binds these ids to HTML treatments.
 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  /** Short label for the visual slot, e.g. "Key stat (73%)" */
  visualHint?: string;
  /** Sample scene for gallery preview */
  sampleText: string;
  sampleEmphasis: string[];
  sampleVisual?: string;
}

export {
  HF_TEMPLATES as TEMPLATES,
  HF_DEFAULT_TEMPLATE_ID as DEFAULT_TEMPLATE_ID,
  normalizeHfTemplateId as normalizeTemplateId,
} from "@/engines/hyperframes/templates";
import { HF_TEMPLATES } from "@/engines/hyperframes/templates";
export function templateName(id: string): string {
  return HF_TEMPLATES.find((t) => t.id === id)?.name ?? id;
}
