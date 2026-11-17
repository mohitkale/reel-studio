/**
 * `npm run illustrations:sheet`: a contact sheet of all sixty illustrations
 * (docs/assets/illustrations/sheet.jpg), each frozen a few seconds into its
 * loop. Needs Chrome through puppeteer, like the frame check.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer";

import {
  ILLUSTRATION_NAMES,
  ILLUSTRATION_STYLES,
  illustrationSvg,
} from "../src/engines/hyperframes/assets/illustrations";

async function main(): Promise<void> {
  const cells = ILLUSTRATION_NAMES.map(
    (name) =>
      `<figure><div class="fx-illus" style="position:relative;opacity:1">${illustrationSvg(name)}</div><figcaption>${name}</figcaption></figure>`,
  ).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0b1020;color:#cbd5e1;font:12px system-ui;--fx-c:#ff6b6b;--fx-glow:#4cc9f0;--fx-ink:#fff}
    main{display:grid;grid-template-columns:repeat(10,180px);gap:8px;padding:8px}
    figure{margin:0;background:#141a33;border-radius:8px;overflow:hidden}
    .fx-illus{width:180px;height:180px}
    figcaption{padding:4px 8px}
    ${ILLUSTRATION_STYLES}
    .il *{animation-delay:-2.5s!important;animation-play-state:paused!important}
  </style><main>${cells}</main>`;
  const browser = await puppeteer.launch({
    executablePath:
      process.env.REEL_VERIFY_CHROME || (await puppeteer.executablePath()),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1880, height: 1300 });
    await page.setContent(html);
    const out = path.resolve("docs", "assets", "illustrations");
    await mkdir(out, { recursive: true });
    await page.screenshot({
      path: path.join(out, "sheet.jpg"),
      type: "jpeg",
      quality: 82,
      fullPage: true,
    });
    console.log(`Wrote ${path.join(out, "sheet.jpg")}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
