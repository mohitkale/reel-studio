// @vitest-environment node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import manifest from "../../public/reel-runtime/manifest.json";

it("freezes genuine runtime bytes and preserves font notices and subset ranges", async () => {
  for (const asset of manifest.assets) {
    const bytes = await readFile(
      path.resolve("public/reel-runtime", asset.filename),
    );
    expect(
      createHash("sha256").update(bytes).digest("hex"),
      asset.filename,
    ).toBe(asset.sha256);
  }
  for (const source of manifest.sources.filter(
    (source) => source.license === "OFL-1.1",
  )) {
    expect(
      await readFile(
        path.resolve("public/reel-runtime", source.notice),
        "utf8",
      ),
    ).toContain("SIL OPEN FONT LICENSE");
  }
  expect(manifest.fontCss).toContain("unicode-range:");
  expect(manifest.fontCss).toContain("eb-garamond-cyrillic");
  expect(manifest.fontCss).toContain("eb-garamond-greek");
  expect(manifest.fontCss).not.toMatch(/https?:/);
});
