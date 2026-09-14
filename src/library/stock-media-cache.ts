import { createHash } from "node:crypto";
import { z } from "zod";

import {
  stockMediaServiceRepository,
  type StockMediaCacheRecord,
} from "@/library/repositories/stock-media-services";
import { stockProviderIdSchema } from "@/providers/stock/schemas";

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function canonicalize(value: unknown): CanonicalJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Stock cache requests require finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Stock cache requests require plain JSON objects");
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  throw new Error("Stock cache requests must be JSON serializable");
}

export function normalizeStockMediaRequest(request: unknown): string {
  return JSON.stringify(canonicalize(request));
}

export function stockMediaRequestHash(
  providerId: string,
  operation: string,
  request: unknown,
): string {
  const normalizedProviderId = stockProviderIdSchema.parse(providerId);
  const normalizedOperation = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/)
    .parse(operation);
  return createHash("sha256")
    .update(
      `${normalizedProviderId}\n${normalizedOperation}\n${normalizeStockMediaRequest(request)}`,
    )
    .digest("hex");
}

export interface StockMediaCachePersistence {
  getCache(requestHash: string): Promise<StockMediaCacheRecord | null>;
  putCache(record: StockMediaCacheRecord): Promise<void>;
  deleteCache(requestHash: string): Promise<void>;
}

const inFlight = new Map<string, Promise<unknown>>();

export async function withStockMediaResponseCache<T>(input: {
  providerId: string;
  operation: string;
  request: unknown;
  ttlMs: number;
  schema: z.ZodType<T>;
  load: () => Promise<T>;
  persistence?: StockMediaCachePersistence;
  now?: () => Date;
}): Promise<T> {
  if (
    !Number.isInteger(input.ttlMs) ||
    input.ttlMs < 0 ||
    input.ttlMs > 604_800_000
  ) {
    throw new Error("Stock response cache TTL must be between 0 and 7 days");
  }
  if (input.ttlMs === 0) return input.schema.parse(await input.load());

  const persistence = input.persistence ?? stockMediaServiceRepository;
  const now = input.now ?? (() => new Date());
  const requestJson = normalizeStockMediaRequest(input.request);
  const requestHash = stockMediaRequestHash(
    input.providerId,
    input.operation,
    input.request,
  );
  const existing = await persistence.getCache(requestHash);
  if (existing && existing.expiresAt.getTime() > now().getTime()) {
    try {
      return input.schema.parse(JSON.parse(existing.responseJson));
    } catch {
      await persistence.deleteCache(requestHash);
    }
  } else if (existing) {
    await persistence.deleteCache(requestHash);
  }

  const pending = inFlight.get(requestHash);
  if (pending) return (await pending) as T;

  const loadAndStore = (async () => {
    const response = input.schema.parse(await input.load());
    const capturedAt = now();
    await persistence.putCache({
      requestHash,
      providerId: stockProviderIdSchema.parse(input.providerId),
      operation: input.operation,
      requestJson,
      responseJson: JSON.stringify(response),
      expiresAt: new Date(capturedAt.getTime() + input.ttlMs),
    });
    return response;
  })();
  inFlight.set(requestHash, loadAndStore);
  try {
    return await loadAndStore;
  } finally {
    if (inFlight.get(requestHash) === loadAndStore)
      inFlight.delete(requestHash);
  }
}
