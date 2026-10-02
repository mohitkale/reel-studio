/** Client-safe literal address policy. DNS must additionally be checked and pinned
 * by the server; a hostname test cannot detect rebinding or nip.io aliases. */
export function isPublicIpAddress(value: string): boolean {
  let host: string;
  try {
    host = new URL(
      value.includes(":")
        ? `http://[${value.replace(/^\[|\]$/g, "")}]`
        : `http://${value}`,
    ).hostname
      .replace(/^\[|\]$/g, "")
      .toLowerCase();
  } catch {
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b, c] = host.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (!host.includes(":")) return false;
  const sides = host.split("::");
  const left = sides[0] ? sides[0].split(":") : [],
    right = sides[1] ? sides[1].split(":") : [];
  const words = (
    sides.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left
  ).map((word) => parseInt(word, 16));
  if (words.length !== 8) return false;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return isPublicIpAddress(
      `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`,
    );
  }
  // Global unicast only; exclude transition/documentation/special-use blocks.
  return (
    words[0] >= 0x2000 &&
    words[0] <= 0x3fff &&
    words[0] !== 0x2002 &&
    !(words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8)) &&
    !(words[0] === 0x3fff && words[1] <= 0x0fff)
  );
}
