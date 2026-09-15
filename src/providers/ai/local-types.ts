import { z } from "zod";

export const LOCAL_AI_PROVIDER_IDS = ["ollama", "lm-studio"] as const;
export type LocalAIProviderId = (typeof LOCAL_AI_PROVIDER_IDS)[number];

export const LOCAL_AI_DEFAULTS: Record<
  LocalAIProviderId,
  {
    baseUrl: string;
    temperature: number;
    contextWindow?: number;
    maxOutputTokens?: number;
  }
> = {
  ollama: {
    baseUrl: "http://127.0.0.1:11434",
    temperature: 0.7,
    contextWindow: 8192,
    maxOutputTokens: 4096,
  },
  "lm-studio": {
    baseUrl: "http://127.0.0.1:1234",
    temperature: 0.7,
    contextWindow: 8192,
    maxOutputTokens: 4096,
  },
};

export const localAIProviderConfigInputSchema = z
  .object({
    baseUrl: z.string().trim().min(1).max(2048),
    modelId: z.string().trim().max(256).default(""),
    temperature: z.number().min(0).max(2),
    contextWindow: z.number().int().min(512).max(262_144).optional(),
    maxOutputTokens: z.number().int().min(64).max(32_768).optional(),
    allowLan: z.boolean().default(false),
    token: z.string().max(4096).optional(),
  })
  .strict();

export const localAIDiagnosticStateSchema = z.enum([
  "not-checked",
  "healthy",
  "offline",
  "missing-model",
  "unloaded-model",
  "authentication-error",
  "unsupported-model",
  "error",
]);
export type LocalAIDiagnosticState = z.infer<
  typeof localAIDiagnosticStateSchema
>;

export const localAIProviderViewSchema = z.object({
  id: z.enum(LOCAL_AI_PROVIDER_IDS),
  label: z.string(),
  baseUrl: z.string(),
  modelId: z.string(),
  temperature: z.number(),
  contextWindow: z.number().int().optional(),
  maxOutputTokens: z.number().int().optional(),
  allowLan: z.boolean(),
  hasToken: z.boolean(),
  endpointScope: z.enum(["loopback", "lan"]).optional(),
  diagnostic: z.object({
    state: localAIDiagnosticStateSchema,
    message: z.string(),
    checkedAt: z.string().datetime({ offset: true }).optional(),
    modelCount: z.number().int().nonnegative().optional(),
    lastSuccessfulDiscoveryAt: z.string().datetime({ offset: true }).optional(),
  }),
});

export type LocalAIProviderConfigInput = z.infer<
  typeof localAIProviderConfigInputSchema
>;
export type LocalAIProviderView = z.infer<typeof localAIProviderViewSchema>;
