import { allowedPresetTemplateIds } from "@/production/ai-preset-plan";

import { planTemplateIdsForEngine, type GeneratePlanInput } from "./types";

export function buildOpenAIVideoPlanJsonSchema(input: GeneratePlanInput) {
  const templateIds = input.productionPresetId
    ? allowedPresetTemplateIds(
        input.productionPresetId,
        input.videoEngine ?? "remotion",
      )
    : [...planTemplateIdsForEngine(input.videoEngine)];
  return {
    name: "scene_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectName: { type: "string" },
        scriptName: { type: "string" },
        styleId: {
          type: "string",
          enum: ["bold-hook", "clean-story", "teach-me", "soft-brand"],
        },
        energy: {
          type: "string",
          enum: ["calm", "normal", "high"],
        },
        scenes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              spokenText: { type: "string" },
              templateId: { type: "string", enum: templateIds },
              emphasis: { type: "array", items: { type: "string" } },
              visual: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              backgroundQuery: { type: "string" },
              mediaKind: { type: "string", enum: ["image", "video"] },
              effect: {
                type: "string",
                enum: [
                  "ken-burns",
                  "pan-left",
                  "pan-right",
                  "pan-up",
                  "pan-down",
                ],
              },
              mood: {
                type: "string",
                enum: [
                  "energetic",
                  "calm",
                  "dramatic",
                  "playful",
                  "inspiring",
                  "tech",
                  "nature",
                ],
              },
              musicMood: { type: "string" },
            },
            required: ["text", "templateId", "emphasis"],
          },
        },
      },
      required: ["projectName", "scriptName", "styleId", "energy", "scenes"],
    },
  };
}

export const OPENAI_PODCAST_JSON_SCHEMA = {
  name: "podcast_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      characters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
          },
          required: ["id", "name", "gender"],
        },
      },
      turns: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            text: { type: "string" },
          },
          required: ["characterId", "text"],
        },
      },
    },
    required: ["characters", "turns"],
  },
};

export const OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA = {
  name: "podcast_clip_suggestions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            startTurnId: { type: "string" },
            endTurnId: { type: "string" },
            label: { type: "string" },
            reason: { type: "string" },
          },
          required: ["startTurnId", "endTurnId", "label", "reason"],
        },
      },
    },
    required: ["suggestions"],
  },
};
