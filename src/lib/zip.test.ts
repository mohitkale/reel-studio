import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildZip, crc32 } from "@/lib/zip";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("is deterministic", () => {
    const files = [{ name: "a.txt", data: bytes("hello") }];
    expect(buildZip(files)).toEqual(buildZip(files));
  });

  it("refuses names that could escape the folder", () => {
    expect(() => buildZip([{ name: "../x.txt", data: bytes("x") }])).toThrow();
    expect(() => buildZip([{ name: "/abs.txt", data: bytes("x") }])).toThrow();
  });

  it("makes an archive the system unzip accepts and reads back", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "reel-zip-"));
    try {
      const file = path.join(dir, "kit.zip");
      writeFileSync(
        file,
        buildZip([
          { name: "description.txt", data: bytes("Hello, café 🎬") },
          {
            name: "captions.srt",
            data: bytes("1\n00:00:00,000 --> 00:00:01,000\nHi\n"),
          },
        ]),
      );
      let listing = "";
      try {
        listing = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
      } catch (error) {
        // A machine without unzip (some Windows runners) cannot run this check.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      expect(listing).toContain("No errors detected");
      const text = execFileSync("unzip", ["-p", file, "description.txt"], {
        encoding: "utf8",
      });
      expect(text).toBe("Hello, café 🎬");
      expect(readFileSync(file).length).toBeGreaterThan(100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
