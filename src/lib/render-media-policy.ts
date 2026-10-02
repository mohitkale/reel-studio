/** Hotlink-only stock is never copied into render projects or the generic store.
 * Unsplash staging remains gated pending API-specific permission. */
export function assertRenderStagingAllowed(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "unsplash.com" || hostname.endsWith(".unsplash.com")) {
    throw new Error(
      "Unsplash export is unavailable: its hotlink policy does not permit render staging. Choose an uploaded asset or downloadable stock provider.",
    );
  }
}
