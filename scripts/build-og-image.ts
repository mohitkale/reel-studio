/**
 * `npm run site:og`: draws `site/assets/og.png` (1200 x 630), the picture that
 * shows when a link to the website is shared. It uses three posters from
 * `npm run demo:assets`, so run that first. The result is committed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const posters = ["listicle", "product-launch", "how-to"].map((name) => {
  const file = path.resolve("dist/demo", `gallery-${name}.jpg`);
  return `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
});

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#0b1020,#1b1f4a);color:#fff;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;display:flex;align-items:center;overflow:hidden}
.t{padding:0 0 0 72px;width:640px}
h1{font-size:64px;line-height:1.08;margin:0 0 22px}
p{font-size:28px;line-height:1.35;margin:0;color:#c7d2fe}
.b{margin-top:34px;display:inline-block;background:#a5b4fc;color:#0b1020;font-weight:700;font-size:26px;padding:12px 24px;border-radius:12px}
.v{display:flex;gap:18px;margin-left:20px;transform:rotate(4deg)}
.v img{width:190px;height:338px;object-fit:cover;border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.45)}
.v img:nth-child(2){margin-top:-60px}
</style>
<div class="t"><h1>Reel Studio</h1><p>Type an idea. Get a finished short video or podcast. Free, on your own computer.</p><span class="b">Local-first · open source</span></div>
<div class="v">${posters.map((src) => `<img src="${src}" alt="">`).join("")}</div>`;

async function main(): Promise<void> {
  const browser = await chromium.launch({
    channel: process.env.E2E_BROWSER ?? "chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  await page.setContent(html);
  writeFileSync(
    path.resolve("site/assets/og.png"),
    await page.screenshot({ type: "png" }),
  );
  await browser.close();
  console.log("Wrote site/assets/og.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
