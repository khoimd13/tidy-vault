import type { CategoryScore } from '../shared/types';
import { heuristicClassifier, type Classifier } from './classifier';
import { ageScore, screenShapeScore } from './signals';
import { zeroShot, type TextBank, type ZeroShotResult } from './zeroShot';

/** Below this total clutter probability a photo is not reported at all. */
const MIN_CLUTTER = 0.3;

/**
 * Zero-shot results only depend on the embedding and the text bank, so they are cached across
 * re-renders (the bank is rebuilt only when the model reloads).
 */
const cache = new WeakMap<TextBank, WeakMap<Float32Array, ZeroShotResult[]>>();

function cachedZeroShot(embedding: Float32Array, bank: TextBank): ZeroShotResult[] {
  let perBank = cache.get(bank);
  if (!perBank) {
    perBank = new WeakMap();
    cache.set(bank, perBank);
  }
  let result = perBank.get(embedding);
  if (!result) {
    result = zeroShot(embedding, bank);
    perBank.set(embedding, result);
  }
  return result;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * CLIP-based classifier.
 * - Confidence = total probability that the photo is clutter of any kind (versus the everyday
 *   "keep" labels). Clutter categories overlap (a shopping page is also a screenshot), so the
 *   total is far more reliable than any single category's share.
 * - Category = the best-matching clutter category, explained by its closest description.
 * - A screen-shaped image and age nudge confidence up, never down.
 * Photos without an embedding yet fall back to the shape heuristic.
 */
export function createClipClassifier(
  bank: TextBank,
  embeddings: ReadonlyMap<string, Float32Array>,
  fallback: Classifier = heuristicClassifier,
): Classifier {
  return {
    score(item, now) {
      if (item.kind !== 'photo') return [];
      const embedding = embeddings.get(item.id);
      if (!embedding) return fallback.score(item, now);

      const results = cachedZeroShot(embedding, bank);
      const best = results[0];
      const clutter = results.reduce((sum, r) => sum + r.prob, 0);
      if (!best || clutter < MIN_CLUTTER) return [];

      const shape = screenShapeScore(item.aspect);
      const age = ageScore(item.takenAt, now);
      let score = clutter + 0.15 * shape * (1 - clutter);
      score = Math.min(1, score + 0.05 * age);

      const reasons = [`Looks like ${best.bestPrompt}`];
      if (shape === 1) reasons.push('Phone-screen shape');
      if (item.takenAt && age > 0.3) reasons.push(`From ${item.takenAt.slice(0, 4)}`);
      const result: CategoryScore = {
        categoryId: best.categoryId,
        score,
        reasons: reasons.map(capitalize),
      };
      return [result];
    },
  };
}
