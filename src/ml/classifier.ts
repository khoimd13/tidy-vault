import type { CategoryScore, Confidence, PhotoItem } from '../shared/types';
import { ageScore, screenShapeScore } from './signals';
import { videoScores } from './videos';

/**
 * Anything that can score a photo against categories.
 * v0: heuristics only. Next: a CLIP-based classifier implementing the same interface.
 */
export interface Classifier {
  score(item: PhotoItem, now: Date): CategoryScore[];
}

export interface Thresholds {
  high: number;
  medium: number;
  /** Below this, the photo is not suggested at all. */
  floor: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { high: 0.8, medium: 0.6, floor: 0.4 };

export function toConfidence(score: number, t: Thresholds = DEFAULT_THRESHOLDS): Confidence | null {
  if (score >= t.high) return 'high';
  if (score >= t.medium) return 'medium';
  if (score >= t.floor) return 'low';
  return null;
}

/** Screenshots from shape and age alone. Good enough to exercise the whole flow end to end. */
export const heuristicClassifier: Classifier = {
  score(item, now) {
    // Without the image model, videos are judged by length only.
    if (item.kind === 'video') return videoScores(item, null);
    const shape = screenShapeScore(item.aspect);
    if (shape === 0) return [];
    const age = ageScore(item.takenAt, now);
    const score = 0.7 * shape + 0.3 * age;

    // Ambiguous shapes top out at Medium (0.7 × 0.5 + 0.3 = 0.65), so only clear phone shapes reach High.
    const reasons = [shape === 1 ? 'Phone-screen shape' : 'Screen shape (could be a photo)'];
    if (item.takenAt && age > 0.3) reasons.push(`From ${item.takenAt.slice(0, 4)}`);
    return [{ categoryId: 'screenshots', score, reasons }];
  },
};

/** Suggests nothing; used while a photo is waiting for the image model. */
export const noSuggestions: Classifier = { score: () => [] };
