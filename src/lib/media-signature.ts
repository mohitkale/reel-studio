/** Reject text/playlist/SVG disguised with an allowed MIME type before native decoders.
 * This is a signature guard, not a complete validation of a media container. */
export function mediaSignatureMatches(
  bytes: Uint8Array,
  mime: string,
): boolean {
  const starts = (prefix: number[]) =>
    bytes.length >= prefix.length &&
    prefix.every((byte, i) => bytes[i] === byte);
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  const iso = bytes.length >= 12 && ascii(4, 8) === "ftyp";
  switch (mime) {
    case "image/png":
      return starts([137, 80, 78, 71, 13, 10, 26, 10]);
    case "image/jpeg":
      return starts([255, 216, 255]);
    case "image/gif":
      return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "video/mp4":
    case "audio/mp4":
      return iso;
    case "video/quicktime":
      return (
        iso ||
        (bytes.length >= 12 && ["moov", "mdat", "wide"].includes(ascii(4, 8)))
      );
    case "video/webm":
      return starts([26, 69, 223, 163]);
    case "audio/wav":
    case "audio/x-wav":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
    case "audio/ogg":
      return ascii(0, 4) === "OggS";
    case "audio/mpeg":
    case "audio/mp3":
      return (
        ascii(0, 3) === "ID3" ||
        (bytes.length >= 2 &&
          bytes[0] === 255 &&
          (bytes[1] & 224) === 224 &&
          (bytes[1] & 6) !== 0)
      );
    case "audio/aac":
      return bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 246) === 240;
    default:
      return false;
  }
}
