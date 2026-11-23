import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { unpackVoicePack } from "./installed-voice-pack";

function archive(entries: Record<string, string>) {
  const bytes = gzipSync(JSON.stringify(entries));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, sha256 };
}

describe("installed Kokoro voice pack", () => {
  it("unpacks the archive whose checksum was pinned by the installed release", () => {
    const entries = { "dist/kokoro.mjs": "c2FtcGxlCg==" };
    const { bytes, sha256 } = archive(entries);
    expect(unpackVoicePack(bytes, sha256)).toEqual(entries);
    expect(() => unpackVoicePack(bytes, "0".repeat(64))).toThrow(/checksum/);
  });

  it.each([
    "../outside",
    "models/../../outside",
    "/absolute",
    "voices\\..\\outside",
  ])(
    "rejects an unsafe entry %s even when the archive matches its checksum",
    (name) => {
      const { bytes, sha256 } = archive({ [name]: "c2FtcGxlCg==" });
      expect(() => unpackVoicePack(bytes, sha256)).toThrow();
    },
  );
});
