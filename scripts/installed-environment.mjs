import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function isInstalledStudio(root) {
  return (
    existsSync(path.join(root, "server.js")) &&
    existsSync(path.join(root, ".next-package", "BUILD_ID"))
  );
}

/** Set before loading Next or the TypeScript CLI so every child inherits it. */
export function configureInstalledEnvironment(root, env = process.env) {
  if (!isInstalledStudio(root)) return false;
  const home = env.REEL_STUDIO_HOME?.trim()
    ? path.resolve(env.REEL_STUDIO_HOME)
    : path.join(os.homedir(), ".reel-studio");
  env.REEL_STUDIO_HOME = home;
  env.REEL_STUDIO_INSTALL_ROOT = path.resolve(root);
  env.DATABASE_URL ??= `file:${path.join(home, "studio.db")}`;
  env.REEL_STUDIO_MEDIA_DIR ??= path.join(home, "media");
  env.REEL_STUDIO_MODEL_CACHE_DIR ??= path.join(home, "models");
  env.NEXT_TELEMETRY_DISABLED ??= "1";
  mkdirSync(env.REEL_STUDIO_MEDIA_DIR, { recursive: true });
  mkdirSync(env.REEL_STUDIO_MODEL_CACHE_DIR, { recursive: true });
  return true;
}
