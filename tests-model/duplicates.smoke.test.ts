/**
 * Opt-in calibration of the near-duplicate threshold with the real model (not part of `npm test`):
 *   SMOKE_DIRS="dirA;dirB" npm run test:model
 * Compares each photo with burst-like variants of itself (slightly cropped, shifted, brighter)
 * and with different photos, and checks that DEFAULT_DUPLICATE_OPTIONS.minSimilarity separates them.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  type Tensor,
} from '@huggingface/transformers';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLIP_MODEL_ID } from '../src/ml/clip/protocol';
import { DEFAULT_DUPLICATE_OPTIONS } from '../src/ml/duplicates';
import { dot, normalize } from '../src/ml/zeroShot';

const dirs = (process.env.SMOKE_DIRS ?? '').split(';').filter(Boolean);

describe.skipIf(dirs.length === 0)('near-duplicate calibration', () => {
  it('separates burst variants from different photos', { timeout: 600_000 }, async () => {
    env.allowRemoteModels = false;
    env.localModelPath = join(import.meta.dirname, '..', 'public', 'models');
    const processor = await AutoProcessor.from_pretrained(CLIP_MODEL_ID);
    const model = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
      dtype: 'q8',
    });
    const embed = async (buf: Buffer) => {
      const image = await RawImage.fromBlob(new Blob([new Uint8Array(buf)]));
      const { image_embeds } = (await model(await processor(image))) as { image_embeds: Tensor };
      return normalize(image_embeds.data as Float32Array);
    };

    const files = dirs.flatMap((d) =>
      readdirSync(d)
        .filter((f) => /\.(jpe?g|png)$/i.test(f))
        .map((f) => join(d, f)),
    );
    const base: Float32Array[] = [];
    const variantSims: number[] = [];
    const byKind: Record<string, number[]> = { crop: [], brighter: [], rotated: [] };
    for (const file of files) {
      const resized = await sharp(file).resize(224, 224, { fit: 'inside' }).jpeg().toBuffer();
      const img = sharp(resized);
      const { width = 224, height = 224 } = await img.metadata();
      const original = await embed(await img.clone().jpeg().toBuffer());
      base.push(original);
      const variants = [
        // A slightly different framing, like the next shot of a burst.
        img
          .clone()
          .extract({
            left: Math.round(width * 0.04),
            top: Math.round(height * 0.03),
            width: Math.round(width * 0.92),
            height: Math.round(height * 0.92),
          })
          .jpeg(),
        img.clone().modulate({ brightness: 1.12 }).jpeg(),
        img.clone().rotate(3).jpeg(),
      ];
      const kinds = ['crop', 'brighter', 'rotated'];
      for (const [k, v] of variants.entries()) {
        const sim = dot(original, await embed(await v.toBuffer()));
        variantSims.push(sim);
        byKind[kinds[k] ?? '?']?.push(sim);
      }
    }
    const differentSims: number[] = [];
    const highPairs: string[] = [];
    for (let i = 0; i < base.length; i++) {
      for (let j = i + 1; j < base.length; j++) {
        const a = base[i];
        const b = base[j];
        if (!a || !b) continue;
        const sim = dot(a, b);
        differentSims.push(sim);
        if (sim >= 0.9)
          highPairs.push(`${sim.toFixed(3)} ${files[i]?.slice(-22)} ~ ${files[j]?.slice(-22)}`);
      }
    }
    for (const [k, xs] of Object.entries(byKind))
      console.log(
        `${k}: min ${Math.min(...xs).toFixed(3)} median ${[...xs].sort()[Math.floor(xs.length / 2)]?.toFixed(3)}`,
      );
    console.log(highPairs.join(' | '));
    const pct = (xs: number[], p: number) =>
      [...xs].sort((x, y) => x - y)[Math.floor((xs.length - 1) * p)] ?? 0;
    const t = DEFAULT_DUPLICATE_OPTIONS.minSimilarity;
    console.log(
      `burst variants: min ${pct(variantSims, 0).toFixed(3)}, 10th pct ${pct(variantSims, 0.1).toFixed(3)}, median ${pct(variantSims, 0.5).toFixed(3)}`,
    );
    console.log(
      `different photos: median ${pct(differentSims, 0.5).toFixed(3)}, 99th pct ${pct(differentSims, 0.99).toFixed(3)}, max ${pct(differentSims, 1).toFixed(3)}`,
    );
    // Rotation adds black corners a real burst doesn't have, so only framing and exposure count.
    const realistic = [...(byKind.crop ?? []), ...(byKind.brighter ?? [])];
    const caught = realistic.filter((s) => s >= t).length / realistic.length;
    const wrong = differentSims.filter((s) => s >= t).length;
    console.log(
      `threshold ${t}: burst-like variants caught ${(caught * 100).toFixed(0)}%, other pairs above (inspect; often real duplicates): ${wrong}/${differentSims.length}`,
    );
    expect(caught).toBeGreaterThanOrEqual(0.9);
    // Different photos are almost never this similar (median ~0.70).
    expect(wrong / differentSims.length).toBeLessThan(0.05);
  });
});
