import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Offline lockfile evidence, including separate copies of transitive packages.
const bytes = await readFile(new URL("../package-lock.json", import.meta.url));
const lock = JSON.parse(bytes.toString());
console.log(
  JSON.stringify(
    {
      lockSha256: createHash("sha256").update(bytes).digest("hex"),
      packages: Object.entries(lock.packages)
        .filter(([location]) => location)
        .map(([location, pkg]) => {
          const metadata = pkg.link
            ? (lock.packages[pkg.resolved] ?? pkg)
            : pkg;
          return {
            location,
            ...(pkg.link ? { linkedSource: pkg.resolved } : {}),
            version: metadata.version,
            license: metadata.license ?? "UNDECLARED",
            dev: Boolean(pkg.dev),
            optional: Boolean(pkg.optional),
          };
        }),
    },
    null,
    2,
  ),
);
