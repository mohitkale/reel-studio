import {
  stockMediaProviderCapabilitiesSchema,
  stockMediaProviderHealthSchema,
  stockMediaQuotaStateSchema,
  resolvedStockAssetSchema,
  stockMediaCandidateSchema,
  stockMediaRenditionSchema,
  stockMediaSearchRequestSchema,
  stockMediaSearchResponseSchema,
  stockProviderIdSchema,
  type StockMediaCandidate,
  type StockMediaProviderCapabilities,
  type StockMediaProviderHealth,
  type StockMediaQuotaState,
  type StockMediaSearchRequest,
  type StockMediaSearchResponse,
} from "./schemas";
import {
  StockError,
  type StockMediaProvider,
  type StockMediaProviderResolution,
  type StockProvider,
} from "./types";
import { createUnsplashProvider } from "./unsplash";
import { createPexelsProvider } from "./pexels";
import { createPixabayProvider } from "./pixabay";
import {
  withStockMediaResponseCache,
  type StockMediaCachePersistence,
} from "@/library/stock-media-cache";
import { stockMediaServiceRepository } from "@/library/repositories/stock-media-services";

/** Existing Unsplash-only entry point retained until Task 11 migrates its callers. */
let instance: StockProvider | null = null;
let mediaInstance: StockMediaProviderRegistry | null = null;

export function getStockProvider(): StockProvider {
  if (!instance) instance = createUnsplashProvider();
  return instance;
}

export interface StockMediaProviderDescriptor {
  id: string;
  label: string;
  capabilities: StockMediaProviderCapabilities;
}

export interface StockMediaQuotaPersistence {
  getQuota(providerId: string): Promise<StockMediaQuotaState | null>;
  putQuota(providerId: string, quota: StockMediaQuotaState): Promise<void>;
}

export interface StockMediaRegistryPersistence
  extends StockMediaCachePersistence, StockMediaQuotaPersistence {}

/** Registry for the provider-neutral API introduced by the local-first plan. */
export class StockMediaProviderRegistry {
  private readonly providers = new Map<string, StockMediaProvider>();

  constructor(
    providers: StockMediaProvider[],
    private readonly persistence: StockMediaRegistryPersistence = stockMediaServiceRepository,
  ) {
    for (const provider of providers) {
      const id = stockProviderIdSchema.parse(provider.id);
      if (id !== provider.id) {
        throw new Error(`Stock media provider id must be normalized: "${id}"`);
      }
      if (this.providers.has(id)) {
        throw new Error(`Duplicate stock media provider "${id}"`);
      }
      stockMediaProviderCapabilitiesSchema.parse(provider.capabilities);
      this.providers.set(id, provider);
    }
  }

  listCapabilities(): StockMediaProviderDescriptor[] {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      label: provider.label,
      capabilities: stockMediaProviderCapabilitiesSchema.parse(
        provider.capabilities,
      ),
    }));
  }

  get(providerId: string): StockMediaProvider {
    const id = stockProviderIdSchema.parse(providerId);
    const provider = this.providers.get(id);
    if (!provider)
      throw new StockError(`Unknown stock provider "${id}"`, 404, id);
    return provider;
  }

  async health(providerId: string): Promise<StockMediaProviderHealth> {
    return stockMediaProviderHealthSchema.parse(
      await this.get(providerId).health(),
    );
  }

  async quota(providerId: string): Promise<StockMediaQuotaState | null> {
    this.get(providerId);
    const quota = await this.persistence.getQuota(providerId);
    return quota ? stockMediaQuotaStateSchema.parse(quota) : null;
  }

  async search(
    providerId: string,
    request: StockMediaSearchRequest,
    signal?: AbortSignal,
  ): Promise<StockMediaSearchResponse> {
    const provider = this.get(providerId);
    const input = stockMediaSearchRequestSchema.parse(request);
    if (!provider.capabilities.kinds.includes(input.kind)) {
      throw new StockError(
        `${provider.label} does not support ${input.kind} search`,
        400,
        provider.id,
      );
    }
    if (input.perPage > provider.capabilities.maxPageSize) {
      throw new StockError(
        `${provider.label} supports at most ${provider.capabilities.maxPageSize} results per page`,
        400,
        provider.id,
      );
    }
    if (input.pageToken && !provider.capabilities.supportsPagination) {
      throw new StockError(
        `${provider.label} does not support pagination`,
        400,
        provider.id,
      );
    }

    const validateProviderResponse = (
      response: StockMediaSearchResponse,
    ): StockMediaSearchResponse => {
      for (const candidate of response.items) {
        if (
          candidate.providerId !== provider.id ||
          candidate.kind !== input.kind ||
          !provider.capabilities.acquisitionPolicies.includes(
            candidate.acquisitionPolicy,
          )
        ) {
          throw new StockError(
            `${provider.label} returned an incompatible stock-media candidate`,
            502,
            provider.id,
          );
        }
      }
      return response;
    };
    const response = await withStockMediaResponseCache({
      providerId: provider.id,
      operation: "search",
      request: input,
      ttlMs: provider.capabilities.defaultCacheTtlSec * 1000,
      schema: stockMediaSearchResponseSchema,
      persistence: this.persistence,
      load: async () => {
        const loaded = stockMediaSearchResponseSchema.parse(
          await provider.search(input, signal),
        );
        validateProviderResponse(loaded);
        if (loaded.quota) {
          await this.persistence.putQuota(
            provider.id,
            stockMediaQuotaStateSchema.parse(loaded.quota),
          );
        }
        return loaded;
      },
    });
    return validateProviderResponse(response);
  }

  async resolve(
    providerId: string,
    candidateInput: StockMediaCandidate,
    renditionId: string,
    signal?: AbortSignal,
  ): Promise<StockMediaProviderResolution> {
    const provider = this.get(providerId);
    const candidate = stockMediaCandidateSchema.parse(candidateInput);
    if (candidate.providerId !== provider.id) {
      throw new StockError(
        "Stock candidate belongs to a different provider",
        400,
        provider.id,
      );
    }
    const rendition = candidate.renderRenditions.find(
      (item) => item.id === renditionId,
    );
    if (!rendition) {
      throw new StockError("Unknown stock-media rendition", 400, provider.id);
    }
    if (!provider.resolve) return { candidate, rendition };
    const resolved = await provider.resolve(candidate, rendition, signal);
    const resolvedCandidate = stockMediaCandidateSchema.parse(
      resolved.candidate,
    );
    const resolvedRendition = stockMediaRenditionSchema.parse(
      resolved.rendition,
    );
    if (
      resolvedCandidate.providerId !== provider.id ||
      !resolvedCandidate.renderRenditions.some(
        (item) =>
          item.id === resolvedRendition.id &&
          item.url === resolvedRendition.url,
      )
    ) {
      throw new StockError(
        `${provider.label} returned an invalid resolved rendition`,
        502,
        provider.id,
      );
    }
    return { candidate: resolvedCandidate, rendition: resolvedRendition };
  }

  async reportUsage(
    providerId: string,
    asset: Parameters<NonNullable<StockMediaProvider["reportUsage"]>>[0],
    signal?: AbortSignal,
  ): Promise<void> {
    const provider = this.get(providerId);
    if (!provider.capabilities.usageReporting || !provider.reportUsage) return;
    const resolved = resolvedStockAssetSchema.parse(asset);
    if (resolved.providerSnapshot.providerId !== provider.id) {
      throw new StockError(
        "Resolved stock asset belongs to a different provider",
        400,
        provider.id,
      );
    }
    await provider.reportUsage(resolved, signal);
  }
}

export function createStockMediaProviderRegistry(
  providers: StockMediaProvider[] = [
    createPexelsProvider(),
    createPixabayProvider(),
  ],
  persistence?: StockMediaRegistryPersistence,
): StockMediaProviderRegistry {
  return new StockMediaProviderRegistry(providers, persistence);
}

/** Built-in provider-neutral registry. Later provider tasks extend this list. */
export function getStockMediaProviderRegistry(): StockMediaProviderRegistry {
  if (!mediaInstance) mediaInstance = createStockMediaProviderRegistry();
  return mediaInstance;
}
