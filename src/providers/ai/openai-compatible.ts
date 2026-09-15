import { z } from "zod";

import { AIError, type AIModel } from "./types";
import { aiFetch } from "./http";
import { secureLocalAIFetch } from "./local-http";
import type { LocalAIProviderId } from "./local-types";

type CompatibleProviderId = "openai" | LocalAIProviderId;

const modelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })).default([]),
});

const completionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});

export interface CompatibleCompletionInput {
  model: string;
  temperature: number;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

type Request = (path: string, init: RequestInit) => Promise<Response>;

export interface OpenAICompatibleTransport {
  listModels(signal?: AbortSignal): Promise<AIModel[]>;
  complete(input: CompatibleCompletionInput): Promise<string>;
}

function createTransport(
  providerId: CompatibleProviderId,
  label: string,
  request: Request,
  outputTokenField: "max_completion_tokens" | "max_tokens",
): OpenAICompatibleTransport {
  async function requireOk(response: Response): Promise<Response> {
    if (response.ok) return response;
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 401 || response.status === 403) {
      throw new AIError(
        `${label} rejected its configured credential (HTTP ${response.status}).`,
        response.status,
        providerId,
      );
    }
    if (response.status === 404) {
      throw new AIError(
        `${label} could not find the requested endpoint or model${detail ? `: ${detail}` : "."}`,
        404,
        providerId,
      );
    }
    if (response.status === 503) {
      throw new AIError(
        `${label} is running but the selected model may be unloaded or unavailable${detail ? `: ${detail}` : "."}`,
        503,
        providerId,
      );
    }
    throw new AIError(
      `${label} request failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      providerId,
    );
  }

  return {
    async listModels(signal) {
      const response = await requireOk(
        await request("/models", { method: "GET", signal }),
      );
      const parsed = modelsResponseSchema.parse(await response.json());
      return parsed.data
        .map(({ id }) => id)
        .sort()
        .map((id) => ({ id, label: id }));
    },

    async complete(input) {
      const response = await requireOk(
        await request("/chat/completions", {
          method: "POST",
          signal: input.signal,
          body: JSON.stringify({
            model: input.model,
            temperature: input.temperature,
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: input.jsonSchema,
            },
            ...(input.maxOutputTokens
              ? { [outputTokenField]: input.maxOutputTokens }
              : {}),
          }),
        }),
      );
      const parsed = completionResponseSchema.parse(await response.json());
      const content = parsed.choices?.[0]?.message?.content ?? "";
      if (!content) {
        throw new AIError(
          `${label} returned an empty response`,
          502,
          providerId,
        );
      }
      return content;
    },
  };
}

/** Fixed-origin cloud transport. The OpenAI key can only be sent to api.openai.com. */
export function createOpenAICloudTransport(
  getApiKey: () => string,
): OpenAICompatibleTransport {
  return createTransport(
    "openai",
    "OpenAI",
    (path, init) =>
      aiFetch(
        `https://api.openai.com/v1${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "content-type": "application/json",
          },
        },
        "openai",
      ),
    "max_completion_tokens",
  );
}

/** Local transport receives only its adapter-owned token; cloud env keys are inaccessible. */
export function createLocalOpenAICompatibleTransport(input: {
  providerId: LocalAIProviderId;
  label: string;
  baseUrl: string;
  allowLan: boolean;
  token?: string;
  timeoutMs?: number;
}): OpenAICompatibleTransport {
  return createTransport(
    input.providerId,
    input.label,
    (path, init) =>
      secureLocalAIFetch({
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        allowLan: input.allowLan,
        path: `/v1${path}`,
        method: init.method === "POST" ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
        },
        body: typeof init.body === "string" ? init.body : undefined,
        signal: init.signal instanceof AbortSignal ? init.signal : undefined,
        timeoutMs: input.timeoutMs,
      }),
    "max_tokens",
  );
}
