// Drives the mock-data UI preview (with ?samples) and saves panel screenshots (PNG, 2x).
// Usage: node store/src/capture-panels.mjs store/src/panels   (needs playwright-core;
// CHROME_PATH optional; PREVIEW_URL defaults to http://localhost:5299/)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:5299/';
const OUT = process.argv[2] ?? 'store/src/panels';
const LANG = process.argv[3] ?? 'en';
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({
  viewport: { width: 400, height: 760 },
  deviceScaleFactor: 2,
  locale: LANG,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(`${BASE}?welcome=no&samples`);
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Find suggestions/ }).click();
// Wait for the scan and the AI to finish.
await page.waitForFunction(
  () => {
    const t = document.body.innerText;
    return /Scan for changes/.test(t) && !document.querySelector('.ai-loader');
  },
  null,
  { timeout: 15 * 60_000, polling: 2000 },
);
await page.waitForTimeout(1500);
await shot('home');
await page.screenshot({ path: `${OUT}/home-full.png`, fullPage: true });

async function openGroup(re) {
  await page.evaluate((src) => {
    const re = new RegExp(src);
    const reviews = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent.trim() === 'Review',
    );
    for (const btn of reviews) {
      let el = btn.parentElement;
      while (
        el &&
        [...el.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Review')
          .length === 1
      ) {
        if (re.test(el.textContent)) {
          btn.click();
          return;
        }
        el = el.parentElement;
      }
    }
    throw new Error('no group ' + src);
  }, re.source);
  await page.waitForTimeout(1500);
}
const back = async () => {
  await page.getByRole('button', { name: /Back/ }).first().click();
  await page.waitForTimeout(800);
};
await openGroup(/near-duplicates/);
await shot('review-dupes');
await back();
await openGroup(/receipts and documents/);
await shot('review-receipts');
await back();
await openGroup(/[0-9]+ screenshots/);
await shot('review-shots');
await page.locator('button.primary').first().click();
await page.waitForTimeout(800);
await shot('review-shots-added');
await back();
await openGroup(/near-duplicates/);
await page.locator('button.primary').first().click();
await page.waitForTimeout(800);
await back();
await openGroup(/receipts and documents/);
await page.locator('button.primary').first().click();
await page.waitForTimeout(800);
await back();
await shot('home-after');
await page.getByRole('button', { name: 'Cleanup list' }).click();
await page.waitForTimeout(1500);
await shot('cleanup');
await page.screenshot({ path: `${OUT}/cleanup-full.png`, fullPage: true });

await browser.close();
