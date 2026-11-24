import type { CategoryScore } from '../shared/types';
import { heuristicClassifier, type Classifier } from './classifier';
import { duplicateScore, type DuplicateMatch } from './duplicates';
import { poorQualityScore, qualityReason, type Quality } from './quality';
import { ageScore, screenShapeScore } from './signals';
import { zeroShot, type TextBank, type ZeroShotResult } from './zeroShot';

/** What the image model measured for one photo. */
export interface Analysis {
  vec: Float32Array;
  /** Sharpness, brightness and contrast of the thumbnail; null for older analyses. */
  quality: Quality | null;
}

/** Below this total clutter probability a photo is not suggested by the AI alone. */
const MIN_CLUTTER = 0.3;
/** Poor-quality score at which a photo the AI sees as a memory is still offered as "not sure". */
const POOR_ENOUGH_ALONE = 0.9;

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
 *   "keep" labels); the category is the best-matching clutter category, explained by its closest
 *   description. A phone-screen shape, poor measured quality and age nudge confidence up.
 * - Measured quality keeps the "blurry" category honest: a photo the model calls blurry but that
 *   measures sharp is toned down; one the model calls a memory but that measures very poor is
 *   still offered, at Medium (never preselected).
 * - Near-duplicates (all but the sharpest of a burst) are suggested from `duplicates`.
 * Photos without an analysis yet use `fallback`.
 */
export function createClipClassifier(
  bank: TextBank,
  analyses: ReadonlyMap<string, Analysis>,
  fallback: Classifier = heuristicClassifier,
  duplicates: ReadonlyMap<string, DuplicateMatch> = new Map(),
): Classifier {
  return {
    score(item, now) {
      if (item.kind !== 'photo') return [];
      const analysis = analyses.get(item.id);
      if (!analysis) return fallback.score(item, now);

      const out: CategoryScore[] = [];
      const results = cachedZeroShot(analysis.vec, bank);
      const best = results[0];
      const clutter = results.reduce((sum, r) => sum + r.prob, 0);
      const age = ageScore(item.takenAt, now);
      const poor = analysis.quality ? poorQualityScore(analysis.quality) : 0;
      const poorReason = analysis.quality ? qualityReason(analysis.quality) : null;
      const dated = (reasons: string[]) => {
        if (item.takenAt && age > 0.3) reasons.push(`From ${item.takenAt.slice(0, 4)}`);
        return reasons.map(capitalize);
      };

      if (best && clutter >= MIN_CLUTTER) {
        const shape = screenShapeScore(item.aspect);
        let score = clutter + 0.15 * shape * (1 - clutter);
        if (best.categoryId === 'blurry' && poor < 0.2) score *= 0.7; // the model guessed; it's sharp
        score += 0.3 * poor * (1 - score);
        score = Math.min(1, score + 0.05 * age);
        // Clearly poor measured quality wins: an empty or very blurry image belongs with the
        // blurry ones whatever the model guessed it shows.
        const poorWins = poor >= POOR_ENOUGH_ALONE && poorReason !== null;
        const reasons = poorWins
          ? [poorReason, `Looks like ${best.bestPrompt}`]
          : [`Looks like ${best.bestPrompt}`];
        if (!poorWins && poorReason && poor >= 0.5) reasons.push(poorReason);
        if (shape === 1) reasons.push('Phone-screen shape');
        const categoryId = poorWins ? 'blurry' : best.categoryId;
        out.push({ categoryId, score, reasons: dated(reasons) });
      } else if (poor >= POOR_ENOUGH_ALONE && poorReason) {
        out.push({ categoryId: 'blurry', score: 0.62, reasons: dated([poorReason]) });
      }

      const dup = duplicates.get(item.id);
      if (dup) {
        const apart = dup.minutesApart === null ? 'the same day' : `${dup.minutesApart} min apart`;
        out.push({
          categoryId: 'duplicates',
          score: duplicateScore(dup.similarity),
          reasons: dated([`Very similar to a photo taken ${apart}`, 'Keeping the sharpest']),
        });
      }
      return out;
    },
  };
}
