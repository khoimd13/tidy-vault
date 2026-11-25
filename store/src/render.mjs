// Renders compose.html into the Chrome Web Store images in store/images/.
// Usage: node store/src/render.mjs [storeSrcDir]   (needs playwright-core; CHROME_PATH optional)
import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Pass the store/src folder when running a copy of this script from elsewhere.
const here = process.argv[2] ?? import.meta.dirname;
const out = join(here, '..', 'images');
const exe = process.env.CHROME_PATH;
const jobs = [
  ['1', 'screenshot-1-suggestions.png'],
  ['2', 'screenshot-2-duplicates.png'],
  ['3', 'screenshot-3-you-decide.png'],
  ['4', 'screenshot-4-cleanup-list.png'],
  ['5', 'screenshot-5-languages.png'],
  ['promo', 'promo-small-440x280.png'],
  ['marquee', 'promo-marquee-1400x560.png'],
];
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({
  viewport: { width: 1400, height: 800 },
  deviceScaleFactor: 1,
});
for (const [slide, file] of jobs) {
  await page.goto(`${pathToFileURL(join(here, 'compose.html')).href}?slide=${slide}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const [w, h] = (await page.title()).split('x').map(Number);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, file), clip: { x: 0, y: 0, width: w, height: h } });
  console.log(file, `${w}x${h}`);
}
await browser.close();
