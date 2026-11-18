import os from "node:os";

import { diagnoseLocalAIProvider } from "@/providers/ai/local-diagnostics";
import {
  LOCAL_AI_DEFINITIONS,
  type LocalAIProviderId,
} from "@/providers/ai/local-definitions";
import {
  memoryTier,
  recommendedWriter,
  sameModel,
  type RecommendedWriter,
} from "@/providers/ai/local-models";
import { pullOllamaModel, type PullProgress } from "@/providers/ai/ollama-pull";
import { LOCAL_AI_DEFAULTS } from "@/providers/ai/local-types";
import { localAIConfigStore } from "@/server/local-ai-config";

/**
 * Getting a storyboard writer running on this computer with as few clicks as
 * possible: find Ollama or LM Studio, offer the model that fits the memory, pull
 * it with progress, and select it. Nothing is installed for the person and no
 * weights are shipped; the model is fetched by Ollama from its own library.
 */
export const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";
export const LM_STUDIO_DOWNLOAD_URL = "https://lmstudio.ai/download";

export interface DetectedServer {
  id: LocalAIProviderId;
  label: string;
  running: boolean;
  models: string[];
}

export type PullState =
  | { state: "idle" }
  | {
      state: "pulling";
      model: string;
      status: string;
      fraction?: number;
      completed?: number;
      total?: number;
    }
  | { state: "done"; model: string }
  | { state: "error"; model: string; message: string };

/** What the person should do next, in plain steps. */
export type NextStep =
  "ready" | "download-model" | "choose-installed" | "install-server";

export interface LocalWriterState {
  memoryBytes: number;
  tier: 8 | 16 | 32;
  recommended: Pick<RecommendedWriter, "ollama" | "label" | "bytes" | "tier">;
  servers: DetectedServer[];
  /** The local writer that is selected and answers. */
  active: { providerId: LocalAIProviderId; modelId: string } | null;
  recommendedInstalled: boolean;
  next: NextStep;
  pull: PullState;
  installUrl: string;
}

interface PullHandle {
  state: PullState;
  abort?: AbortController;
}

const globalKey = "__reelLocalWriterPull" as const;
function pullHandle(): PullHandle {
  const holder = globalThis as unknown as Record<string, PullHandle>;
  holder[globalKey] ??= { state: { state: "idle" } };
  return holder[globalKey];
}

async function probe(id: LocalAIProviderId): Promise<DetectedServer> {
  const stored = await localAIConfigStore.readProvider(id);
  // A server the person already configured is checked where they put it.
  const diagnostic = await diagnoseLocalAIProvider(id, {
    baseUrl: stored.baseUrl || LOCAL_AI_DEFAULTS[id].baseUrl,
    modelId: "",
    allowLan: stored.allowLan,
    token: stored.token,
  });
  const running =
    diagnostic.state === "healthy" || diagnostic.state === "missing-model";
  return {
    id,
    label: LOCAL_AI_DEFINITIONS[id].label,
    running,
    models: running ? (diagnostic.modelIds ?? []) : [],
  };
}

export async function detectLocalWriter(
  memoryBytes = os.totalmem(),
): Promise<LocalWriterState> {
  const recommended = recommendedWriter(memoryBytes);
  const servers = await Promise.all([probe("ollama"), probe("lm-studio")]);
  let active: LocalWriterState["active"] = null;
  for (const server of servers) {
    const stored = await localAIConfigStore.readProvider(server.id);
    if (
      stored.modelId &&
      server.running &&
      server.models.some((model) => sameModel(model, stored.modelId))
    ) {
      active = { providerId: server.id, modelId: stored.modelId };
      break;
    }
  }
  const ollama = servers.find((server) => server.id === "ollama")!;
  const recommendedInstalled = ollama.models.some((model) =>
    sameModel(model, recommended.ollama),
  );
  const anyInstalled = servers.some(
    (server) => server.running && server.models.length > 0,
  );
  let next: NextStep;
  if (active) next = "ready";
  else if (ollama.running && !recommendedInstalled && !anyInstalled)
    next = "download-model";
  else if (anyInstalled) next = "choose-installed";
  else if (ollama.running) next = "download-model";
  else next = "install-server";
  return {
    memoryBytes,
    tier: memoryTier(memoryBytes),
    recommended: {
      ollama: recommended.ollama,
      label: recommended.label,
      bytes: recommended.bytes,
      tier: recommended.tier,
    },
    servers,
    active,
    recommendedInstalled,
    next,
    pull: pullHandle().state,
    installUrl: OLLAMA_DOWNLOAD_URL,
  };
}

/** Select a model that is already installed as the storyboard writer. */
export async function selectLocalWriterModel(
  providerId: LocalAIProviderId,
  modelId: string,
): Promise<void> {
  const stored = await localAIConfigStore.readProvider(providerId);
  const config = {
    baseUrl: stored.baseUrl || LOCAL_AI_DEFAULTS[providerId].baseUrl,
    modelId,
    temperature: stored.temperature,
    contextWindow: stored.contextWindow,
    maxOutputTokens: stored.maxOutputTokens,
    allowLan: stored.allowLan,
  };
  await localAIConfigStore.save(providerId, config);
  const diagnostic = await diagnoseLocalAIProvider(providerId, {
    ...config,
    token: stored.token,
  });
  await localAIConfigStore.recordDiagnostic(providerId, diagnostic);
}

/**
 * Start downloading a model into Ollama and select it when it is done. One
 * download at a time; asking again while one runs returns the running state.
 */
export function startModelPull(model: string): PullState {
  const handle = pullHandle();
  if (handle.state.state === "pulling") return handle.state;
  const abort = new AbortController();
  handle.abort = abort;
  handle.state = { state: "pulling", model, status: "Starting" };
  void (async () => {
    try {
      const stored = await localAIConfigStore.readProvider("ollama");
      await pullOllamaModel({
        baseUrl: stored.baseUrl || LOCAL_AI_DEFAULTS.ollama.baseUrl,
        allowLan: stored.allowLan,
        model,
        signal: abort.signal,
        onProgress: (progress: PullProgress) => {
          handle.state = {
            state: "pulling",
            model,
            status: progress.status,
            fraction: progress.fraction,
            completed: progress.completed,
            total: progress.total,
          };
        },
      });
      await selectLocalWriterModel("ollama", model);
      handle.state = { state: "done", model };
    } catch (error) {
      handle.state = abort.signal.aborted
        ? { state: "idle" }
        : {
            state: "error",
            model,
            message: error instanceof Error ? error.message : String(error),
          };
    } finally {
      handle.abort = undefined;
    }
  })();
  return handle.state;
}

export function cancelModelPull(): PullState {
  const handle = pullHandle();
  handle.abort?.abort();
  handle.state = { state: "idle" };
  return handle.state;
}
