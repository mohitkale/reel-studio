import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  LOCAL_AI_DEFAULTS,
  LOCAL_AI_PROVIDER_IDS,
  localAIDiagnosticStateSchema,
  localAIProviderConfigInputSchema,
  type LocalAIProviderConfigInput,
  type LocalAIProviderId,
  type LocalAIProviderView,
} from "@/providers/ai/local-types";
import { validateLocalAIEndpoint } from "@/providers/ai/local-endpoint";

const diagnosticSchema = z
  .object({
    state: localAIDiagnosticStateSchema,
    message: z.string().max(2000),
    checkedAt: z.string().datetime({ offset: true }).optional(),
    modelIds: z.array(z.string().max(256)).max(500).optional(),
  })
  .strict();

const storedProviderSchema = localAIProviderConfigInputSchema
  .omit({ token: true })
  .extend({
    token: z.string().max(4096).optional(),
    endpointScope: z.enum(["loopback", "lan"]).optional(),
    diagnostic: diagnosticSchema.optional(),
    lastSuccessfulDiscovery: z
      .object({
        checkedAt: z.string().datetime({ offset: true }),
        modelIds: z.array(z.string().max(256)).max(500),
      })
      .strict()
      .optional(),
  })
  .strict();

const localAIConfigFileSchema = z
  .object({
    version: z.literal(1),
    providers: z.object({
      ollama: storedProviderSchema.optional(),
      "lm-studio": storedProviderSchema.optional(),
    }),
  })
  .strict();

type LocalAIConfigFile = z.infer<typeof localAIConfigFileSchema>;
type StoredProvider = z.infer<typeof storedProviderSchema>;

const LABELS: Record<LocalAIProviderId, string> = {
  ollama: "Ollama",
  "lm-studio": "LM Studio",
};

function defaultFilePath(): string {
  return path.join(process.cwd(), ".data", "local-ai-config.json");
}

function emptyFile(): LocalAIConfigFile {
  return { version: 1, providers: {} };
}

function defaultProvider(id: LocalAIProviderId): StoredProvider {
  return {
    ...LOCAL_AI_DEFAULTS[id],
    modelId: "",
    allowLan: false,
  };
}

export function createLocalAIConfigStore(filePath = defaultFilePath()) {
  let pendingMutation = Promise.resolve();

  async function read(): Promise<LocalAIConfigFile> {
    try {
      return localAIConfigFileSchema.parse(
        JSON.parse(await fs.readFile(filePath, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyFile();
      throw error;
    }
  }

  async function write(config: LocalAIConfigFile): Promise<void> {
    const directory = path.dirname(filePath);
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporary, filePath);
    await fs.chmod(filePath, 0o600);
  }

  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = pendingMutation.then(operation);
    pendingMutation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function save(
    id: LocalAIProviderId,
    input: LocalAIProviderConfigInput,
  ): Promise<LocalAIProviderView> {
    const parsed = localAIProviderConfigInputSchema.parse(input);
    const endpoint = await validateLocalAIEndpoint(
      parsed.baseUrl,
      parsed.allowLan,
    );
    return mutate(async () => {
      const current = await read();
      const previous = current.providers[id];
      const token =
        id === "lm-studio"
          ? parsed.token === undefined
            ? previous?.token
            : parsed.token.trim() || undefined
          : undefined;
      current.providers[id] = {
        ...parsed,
        baseUrl: endpoint.baseUrl,
        token,
        endpointScope: endpoint.scope,
        diagnostic:
          previous?.baseUrl === endpoint.baseUrl &&
          previous.modelId === parsed.modelId
            ? previous.diagnostic
            : undefined,
      };
      await write(current);
      return view(id, current.providers[id]);
    });
  }

  async function recordDiagnostic(
    id: LocalAIProviderId,
    diagnostic: z.infer<typeof diagnosticSchema>,
  ): Promise<void> {
    const parsed = diagnosticSchema.parse(diagnostic);
    return mutate(async () => {
      const current = await read();
      const previous = current.providers[id] ?? defaultProvider(id);
      current.providers[id] = {
        ...previous,
        diagnostic: parsed,
        lastSuccessfulDiscovery:
          parsed.modelIds && parsed.checkedAt
            ? { checkedAt: parsed.checkedAt, modelIds: parsed.modelIds }
            : previous.lastSuccessfulDiscovery,
      };
      await write(current);
    });
  }

  function view(
    id: LocalAIProviderId,
    stored: StoredProvider = defaultProvider(id),
  ): LocalAIProviderView {
    const diagnostic = stored.diagnostic ?? {
      state: "not-checked" as const,
      message: "Save the endpoint, then check server and model availability.",
    };
    return {
      id,
      label: LABELS[id],
      baseUrl: stored.baseUrl,
      modelId: stored.modelId,
      temperature: stored.temperature,
      contextWindow: stored.contextWindow,
      maxOutputTokens: stored.maxOutputTokens,
      allowLan: stored.allowLan,
      hasToken: Boolean(stored.token),
      endpointScope: stored.endpointScope,
      diagnostic: {
        state: diagnostic.state,
        message: diagnostic.message,
        checkedAt: diagnostic.checkedAt,
        modelCount: diagnostic.modelIds?.length,
        modelIds:
          diagnostic.modelIds ?? stored.lastSuccessfulDiscovery?.modelIds,
        lastSuccessfulDiscoveryAt: stored.lastSuccessfulDiscovery?.checkedAt,
      },
    };
  }

  return {
    readProvider: async (id: LocalAIProviderId) => {
      const file = await read();
      return file.providers[id] ?? defaultProvider(id);
    },
    list: async () => {
      const file = await read();
      return LOCAL_AI_PROVIDER_IDS.map((id) => view(id, file.providers[id]));
    },
    save,
    recordDiagnostic,
  };
}

export const localAIConfigStore = createLocalAIConfigStore();
