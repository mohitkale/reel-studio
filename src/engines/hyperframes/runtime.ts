import gsapPackage from "gsap/package.json";

/** Preview and localized export use the same installed animation runtime. */
export const GSAP_CDN_URL =
  `https://cdn.jsdelivr.net/npm/gsap@${gsapPackage.version}/dist/gsap.min.js`;

/** Frozen catalog revisions retain their original runtime URL. */
export const LOCALIZABLE_GSAP_URLS = [
  GSAP_CDN_URL,
  "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js",
] as const;
