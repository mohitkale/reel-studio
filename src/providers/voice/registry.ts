import {
  type ProviderId,
  type ProviderStatus,
  type VoiceProvider,
  PROVIDER_IDS,
  ProviderError,
} from "./types";
import { createCartesiaProvider, CARTESIA_DEFAULT_MODEL } from "./cartesia";
import {
  createElevenLabsProvider,
  ELEVENLABS_DEFAULT_MODEL,
} from "./elevenlabs";

/**
 * Provider registry / factory.
 *
 * To add a new TTS vendor: implement VoiceProvider in a new file, then add one
 * entry here. Nothing else in the app references vendors directly.
 */
const factories: Record<
  ProviderId,
  { create: () => VoiceProvider; defaultModel: string }
> = {
  cartesia: {
    create: createCartesiaProvider,
    defaultModel: CARTESIA_DEFAULT_MODEL,
  },
  elevenlabs: {
    create: createElevenLabsProvider,
    defaultModel: ELEVENLABS_DEFAULT_MODEL,
  },
};

// Cache instances; they are stateless and read the key from env on each call.
const instances = new Map<ProviderId, VoiceProvider>();

export function getProvider(id: ProviderId): VoiceProvider {
  const entry = factories[id];
  if (!entry) {
    throw new ProviderError(`Unknown provider "${id}"`, 404);
  }
  let instance = instances.get(id);
  if (!instance) {
    instance = entry.create();
    instances.set(id, instance);
  }
  return instance;
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function defaultModelFor(id: ProviderId): string {
  return factories[id].defaultModel;
}

/** Status for every known provider (label + whether a key is configured). */
export function listProviderStatuses(): ProviderStatus[] {
  return PROVIDER_IDS.map((id) => {
    const provider = getProvider(id);
    return {
      id,
      label: provider.label,
      configured: provider.isConfigured(),
      defaultModel: factories[id].defaultModel,
    };
  });
}
