import type { Orientation } from "@/lib/orientation";
import type { SceneBackground } from "@/compositions/types";
import { getStockProvider } from "@/providers/stock/registry";

interface BackgroundRequest {
  backgroundQuery?: string;
  effect?: SceneBackground["effect"];
}

/**
 * Turn the AI director's per-scene `backgroundQuery` suggestions into concrete
 * scene backgrounds via the configured stock-image provider. Best-effort: if no
 * provider key is set, a query is empty, or a lookup fails, that scene gets no
 * background (returned as `undefined`). The result is aligned by index to the
 * input `scenes`.
 */
export async function resolveSceneBackgrounds<T extends BackgroundRequest>(
  scenes: T[],
  orientation: Orientation,
): Promise<(SceneBackground | undefined)[]> {
  const results: (SceneBackground | undefined)[] = new Array(scenes.length).fill(
    undefined,
  );

  const provider = getStockProvider();
  if (!provider.isConfigured()) return results;

  // Bounded concurrency to stay within the provider's rate limit.
  const CONCURRENCY = 3;
  let cursor = 0;
  async function worker() {
    while (cursor < scenes.length) {
      const i = cursor++;
      const query = scenes[i].backgroundQuery?.trim();
      if (!query) continue;
      try {
        const images = await provider.search(query, orientation, 3);
        const chosen = images[0];
        if (chosen) {
          provider.trackUsage?.(chosen);
          results[i] = {
            type: "image",
            url: chosen.url,
            effect: scenes[i].effect ?? "ken-burns",
          };
        }
      } catch {
        // best-effort — leave this scene without a background
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, scenes.length) }, worker),
  );
  return results;
}
