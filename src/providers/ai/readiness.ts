import type { GenerationProbe } from "./readiness-schema";
import {
  scenePlanSchema,
  type AIProvider,
  type GeneratePlanInput,
} from "./types";

/** A deliberately small opt-in inference. Model listing alone proves no schema capability. */
export async function probeCreationProvider(
  provider: AIProvider,
  modelId: string,
  language: GenerationProbe["language"],
  signal: AbortSignal,
): Promise<GenerationProbe> {
  const started = performance.now();
  const input: GeneratePlanInput = {
    mode: "story",
    modelId,
    sceneCount: 1,
    mediaPreference: "none",
    videoEngine: "hyperframes",
    brief: `Create one scene in ${language} about this supplied statement: Review supplied content before export. Use only this statement.`,
    signal,
  };
  const plan = scenePlanSchema.parse(await provider.generatePlan(input));
  signal.throwIfAborted();
  return {
    modelId,
    checkedAt: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - started),
    language,
    structuredOutput: plan.scenes.length > 0,
  };
}
