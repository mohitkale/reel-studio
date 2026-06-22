import path from "node:path";

import { type AssetStore } from "./types";
import { LocalDiskStore } from "./local-disk";

export type { AssetStore, StoredAsset } from "./types";

let store: AssetStore | undefined;

/**
 * Returns the active asset store. Local disk for now; swap the implementation
 * here (e.g. an S3/R2 store) to move binary assets to the cloud later.
 */
export function getAssetStore(): AssetStore {
  if (!store) {
    store = new LocalDiskStore(path.join(process.cwd(), "media"));
  }
  return store;
}
