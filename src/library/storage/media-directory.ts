import path from "node:path";

/** Source checkouts retain their existing media folder. Packaged installs supply a per-user path. */
export function mediaDirectory(): string {
  const override = process.env.REEL_STUDIO_MEDIA_DIR?.trim();
  return override ? path.resolve(override) : path.resolve("media");
}
