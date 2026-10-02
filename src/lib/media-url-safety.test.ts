import { describe, expect, it } from "vitest";
import {
  assertSafeMediaUrl,
  isPrivateOrLocalHostname,
} from "./media-url-safety";
import { isPublicIpAddress } from "./public-address";
describe("media literal address policy", () => {
  it.each([
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:a00:1",
    "::127.0.0.1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "2001:db8::1",
    "fe90::1",
    "3fff::1",
    "2130706433",
    "0x7f000001",
    "127.1",
    "localhost.",
  ])("rejects disguised/non-public literals: %s", (value) => {
    expect(isPrivateOrLocalHostname(value)).toBe(true);
    if (value !== "localhost.") expect(isPublicIpAddress(value)).toBe(false);
  });
  it.each(["93.184.216.34", "2606:4700:4700::1111", "::ffff:5db8:d822"])(
    "accepts public literals: %s",
    (value) => expect(isPublicIpAddress(value)).toBe(true),
  );
  it("keeps app media valid and requires server DNS checks for hostnames", () => {
    expect(() => assertSafeMediaUrl("/media/assets/clip.mp4")).not.toThrow();
    expect(isPrivateOrLocalHostname("127.0.0.1.nip.io")).toBe(false); // DNS cannot be classified client-side.
    expect(() => assertSafeMediaUrl("https://[::ffff:7f00:1]/x")).toThrow(
      /private/i,
    );
    expect(() => assertSafeMediaUrl("/media/../secret")).toThrow();
  });
});
