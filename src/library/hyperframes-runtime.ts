import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../../public/reel-runtime/manifest.json";

/** Preview and export consume the same vendored bytes, including font subsets. */
export async function copyHyperframesRuntime(directory: string) {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    manifest.assets.map(({ filename }) =>
      copyFile(
        path.resolve("public/reel-runtime", filename),
        path.join(directory, filename),
      ),
    ),
  );
}
