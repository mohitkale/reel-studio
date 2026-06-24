import { type StockProvider } from "./types";
import { createUnsplashProvider } from "./unsplash";

/**
 * Stock-image provider registry. Single provider (Unsplash) for now; add a
 * vendor by implementing StockProvider and registering it here.
 */
let instance: StockProvider | null = null;

export function getStockProvider(): StockProvider {
  if (!instance) instance = createUnsplashProvider();
  return instance;
}
