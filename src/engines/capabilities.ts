import { getVideoEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";

export function capabilityIdsForEngine(engineId: VideoEngineId): string[] {
  return Object.values(getVideoEngine(engineId).capabilities.templates).map(
    (capability) => capability.capabilityId,
  );
}

export function capabilityIdForTemplateId(
  engineId: VideoEngineId,
  templateId: string,
): string | undefined {
  return getVideoEngine(engineId).capabilities.templates[templateId]
    ?.capabilityId;
}

export function templateIdForCapabilityId(
  capabilityId: string,
): string | undefined {
  for (const engineId of ["hyperframes", "remotion"] as const) {
    const match = Object.values(
      getVideoEngine(engineId).capabilities.templates,
    ).find((capability) => capability.capabilityId === capabilityId);
    if (match) return match.templateId;
  }
  return undefined;
}
