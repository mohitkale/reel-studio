import {
  getStockMediaSelection,
  saveStockMediaSelection,
} from "@/library/repositories/stock-media-selections";
import {
  getStockMediaProviderRegistry,
  type StockMediaProviderRegistry,
} from "@/providers/stock/registry";
import {
  resolvedStockAssetSchema,
  stockMediaUsageEventSchema,
  type ResolvedStockAsset,
  type StockMediaSelectionDTO,
  type StockMediaUsageEvent,
} from "@/providers/stock/schemas";

interface StockMediaSelectionPersistence {
  get(sceneId: string): Promise<StockMediaSelectionDTO | null>;
  save(
    sceneId: string,
    snapshot: ResolvedStockAsset,
  ): Promise<StockMediaSelectionDTO>;
}

export interface ReportStockMediaUsageOptions {
  registry?: StockMediaProviderRegistry;
  persistence?: StockMediaSelectionPersistence;
  signal?: AbortSignal;
}

const defaultPersistence: StockMediaSelectionPersistence = {
  get: getStockMediaSelection,
  save: saveStockMediaSelection,
};

const reportsInFlight = new Map<
  string,
  Promise<StockMediaSelectionDTO | null>
>();

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Usage report failed";
  return message.trim().slice(0, 1000) || "Usage report failed";
}

/**
 * Report a selected provider asset once and persist the known outcome.
 * Failed or already reported events are not retried automatically.
 */
export async function reportStockMediaSelectionUsage(
  sceneId: string,
  options: ReportStockMediaUsageOptions = {},
): Promise<StockMediaSelectionDTO | null> {
  const existing = reportsInFlight.get(sceneId);
  if (existing) return existing;

  const operation = (async () => {
    const persistence = options.persistence ?? defaultPersistence;
    const selection = await persistence.get(sceneId);
    if (!selection || selection.snapshot.usageEvent.state !== "pending") {
      return selection;
    }
    const snapshot = resolvedStockAssetSchema.parse(selection.snapshot);
    let event: StockMediaUsageEvent;
    try {
      event = stockMediaUsageEventSchema.parse(
        await (options.registry ?? getStockMediaProviderRegistry()).reportUsage(
          snapshot.providerSnapshot.providerId,
          snapshot,
          options.signal,
        ),
      );
    } catch (error) {
      await persistence.save(
        sceneId,
        resolvedStockAssetSchema.parse({
          ...snapshot,
          usageEvent: stockMediaUsageEventSchema.parse({
            state: "failed",
            error: errorMessage(error),
          }),
        }),
      );
      throw error;
    }
    return persistence.save(
      sceneId,
      resolvedStockAssetSchema.parse({ ...snapshot, usageEvent: event }),
    );
  })().finally(() => reportsInFlight.delete(sceneId));

  reportsInFlight.set(sceneId, operation);
  return operation;
}
