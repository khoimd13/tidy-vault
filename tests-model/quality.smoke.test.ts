/**
 * Opt-in calibration of the quality thresholds on real images (not part of `npm test`):
 *   SMOKE_DIRS="dirA;dirB" npm run test:model
 * Each image is resized like a Google thumbnail (224 px) and compared with blurred and darkened
 * copies of itself. Prints the measurements and checks that the thresholds separate them.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { measureQuality, poorQualityScore, type Quality } from '../src/ml/quality';

const dirs = (process.env.SMOKE_DIRS ?? '').split(';').filter(Boolean);

async function qualityOf(img: ReturnType<typeof sharp>): Promise<Quality> {
  const { data, info } = await img
    .resize(224, 224, { fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return measureQuality(data, info.width, info.height);
}

describe.skipIf(dirs.length === 0)('quality calibration', () => {
  it('separates originals from blurred and dark copies', { timeout: 300_000 }, async () => {
    const rows: Record<string, number | string>[] = [];
    for (const dir of dirs) {
      for (const name of readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
        const file = join(dir, name);
        const original = await qualityOf(sharp(file));
        const blurred = await qualityOf(sharp(file).blur(4));
        const dark = await qualityOf(sharp(file).linear(0.12, 0));
        rows.push({
          file: name.slice(-22),
          sharp: Math.round(original.sharpness),
          blurred: Math.round(blurred.sharpness),
          poorOrig: Math.round(poorQualityScore(original) * 100) / 100,
          poorBlur: Math.round(poorQualityScore(blurred) * 100) / 100,
          poorDark: Math.round(poorQualityScore(dark) * 100) / 100,
        });
      }
    }
    console.table(rows);
    const n = rows.length;
    const origFlagged = rows.filter((r) => Number(r.poorOrig) >= 0.8).length;
    const blurCaught = rows.filter((r) => Number(r.poorBlur) >= 0.8).length;
    const darkCaught = rows.filter((r) => Number(r.poorDark) >= 0.8).length;
    console.log(
      `originals flagged: ${origFlagged}/${n}, blurred caught: ${blurCaught}/${n}, dark caught: ${darkCaught}/${n}`,
    );
    expect(blurCaught / n).toBeGreaterThanOrEqual(0.9);
    expect(darkCaught / n).toBeGreaterThanOrEqual(0.9);
  });
});
