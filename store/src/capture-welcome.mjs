// Saves the welcome screen of the UI preview in several languages (PNG, 2x).
// Usage: node store/src/capture-welcome.mjs <outDir>   (preview on http://localhost:5299)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'store/src/panels';
const BASE = process.env.PREVIEW_URL ?? 'http://localhost:5299/';
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const lang of ['vi', 'ja', 'de', 'th', 'es', 'ko']) {
  const ctx = await browser.newContext({
    viewport: { width: 400, height: 760 },
    deviceScaleFactor: 2,
    locale: lang,
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/welcome-${lang}.png` });
  await ctx.close();
}
await browser.close();
