/**
 * Opt-in check of the real CLIP model on real images (not part of `npm test`):
 *   npm run model:fetch
 *   SMOKE_DIRS="dirA;dirB" npm run test:model
 * Each directory name containing "shot" is treated as screenshots, others as normal photos.
 * Prints a table and asserts that screenshots score high and normal photos are not suggested.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  type Tensor,
} from '@huggingface/transformers';
import { describe, expect, it } from 'vitest';
import { createClipClassifier } from '../src/ml/clipClassifier';
import { measureQuality } from '../src/ml/quality';
import { toConfidence } from '../src/ml/classifier';
import { buildTextBank } from '../src/ml/zeroShot';
import { CLIP_MODEL_ID } from '../src/ml/clip/protocol';
import { CATEGORIES, KEEP_PROMPTS } from '../src/shared/categories';
import type { PhotoItem } from '../src/shared/types';

const dirs = (process.env.SMOKE_DIRS ?? '').split(';').filter(Boolean);

describe.skipIf(dirs.length === 0)('CLIP smoke test', () => {
  it('separates screenshots from photos', { timeout: 600_000 }, async () => {
    env.allowRemoteModels = false;
    env.localModelPath = join(import.meta.dirname, '..', 'public', 'models');

    const tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL_ID);
    const textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
      dtype: 'q8',
    });
    const processor = await AutoProcessor.from_pretrained(CLIP_MODEL_ID);
    const visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
      dtype: 'q8',
    });

    const texts = [...CATEGORIES.flatMap((c) => c.prompts), ...KEEP_PROMPTS];
    const { text_embeds } = (await textModel(
      tokenizer(texts, { padding: true, truncation: true }),
    )) as { text_embeds: Tensor };
    const d = text_embeds.dims[1] ?? 0;
    const data = text_embeds.data as Float32Array;
    const textVecs = new Map(texts.map((t, i) => [t, data.slice(i * d, (i + 1) * d)]));
    const bank = buildTextBank(CATEGORIES, KEEP_PROMPTS, textVecs);

    const rows: { file: string; expected: string; got: string; score: number; why: string }[] = [];
    for (const dir of dirs) {
      const isShot = /shot/i.test(dir);
      for (const name of readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
        const image = await RawImage.read(join(dir, name));
        const { image_embeds } = (await visionModel(await processor(image))) as {
          image_embeds: Tensor;
        };
        const item: PhotoItem = {
          id: name,
          url: '',
          thumbUrl: '',
          takenAt: null,
          aspect: image.width / image.height,
          kind: 'photo',
          label: '',
        };
        const gray = (await image.clone().resize(224, 224)).grayscale();
        const quality = measureQuality(gray.data, gray.width, gray.height);
        const classifier = createClipClassifier(
          bank,
          new Map([
            [
              name,
              {
                vec: image_embeds.data as Float32Array,
                quality,
              },
            ],
          ]),
        );
        const best = classifier.score(item, new Date()).sort((a, b) => b.score - a.score)[0];
        rows.push({
          file: name,
          expected: isShot ? 'clutter' : 'keep',
          got: best ? `${best.categoryId}/${toConfidence(best.score) ?? '-'}` : 'keep',
          score: Math.round((best?.score ?? 0) * 100) / 100,
          why: best?.reasons[0] ?? '',
        });
      }
    }
    console.table(rows);

    const shots = rows.filter((r) => r.expected === 'clutter');
    const photos = rows.filter((r) => r.expected === 'keep');
    const shotHits = shots.filter((r) => r.got !== 'keep' && !r.got.endsWith('/-')).length;
    // A High backed by measured poor quality (blank, very dark or very blurry) is correct.
    const photoFalseHigh = photos.filter(
      (r) => r.got.endsWith('/high') && !/^(Very|Almost|Washed|Looks blurry)/.test(r.why),
    ).length;
    console.log(`screenshots suggested: ${shotHits}/${shots.length}`);
    console.log(`photos wrongly at High: ${photoFalseHigh}/${photos.length}`);
    expect(photoFalseHigh).toBe(0);
    expect(shotHits / Math.max(1, shots.length)).toBeGreaterThanOrEqual(0.8);
  });
});
