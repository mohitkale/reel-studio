/**
 * Storage abstraction. Binary assets (audio, images, Lottie, video) live behind
 * this interface. Local disk now; a cloud blob impl later is one new file that
 * satisfies AssetStore, swapped in getAssetStore().
 */
export interface StoredAsset {
  /** Stable key, e.g. "takes/<id>.wav". Stored in the DB. */
  key: string;
}

export interface AssetStore {
  /** Persist bytes under key, returning the stored reference. */
  put(key: string, data: Buffer): Promise<StoredAsset>;
  /** Read bytes back. Throws if missing. */
  get(key: string): Promise<Buffer>;
  /** Public URL the browser can fetch (served by the app). */
  url(key: string): string;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
