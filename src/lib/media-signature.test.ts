import { describe, expect, it } from "vitest";
import { mediaSignatureMatches } from "./media-signature";

describe("native media boundary", () => {
  it.each([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "audio/wav",
    "audio/mpeg",
    "audio/ogg",
    "audio/aac",
    "audio/mp4",
  ])("rejects executable and network text disguised as %s", (mime) => {
    for (const text of [
      "<svg onload='alert(1)'/>",
      "<html>private content</html>",
      "#EXTM3U\nhttp://169.254.169.254/secret",
      "[playlist]\nFile1=http://localhost/",
    ])
      expect(mediaSignatureMatches(Buffer.from(text), mime)).toBe(false);
  });
  it("accepts image/audio containers while rejecting a mismatched MIME", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "base64");
    const wav = Buffer.alloc(32);
    wav.write("RIFF");
    wav.write("WAVE", 8);
    expect(mediaSignatureMatches(png, "image/png")).toBe(true);
    expect(mediaSignatureMatches(wav, "audio/wav")).toBe(true);
    expect(mediaSignatureMatches(wav, "image/webp")).toBe(false);
    expect(mediaSignatureMatches(png, "video/mp4")).toBe(false);
  });
});
