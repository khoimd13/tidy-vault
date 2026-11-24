/**
 * Learning from the person's own decisions (pure): photos close to ones they kept are suggested
 * less (or not at all), photos close to ones they added to the cleanup list a little more, and a
 * category whose suggestions they often reject becomes more cautious.
 */
import type { CategoryScore, Decision } from '../shared/types';
import type { Classifier } from './classifier';
import { dot, normalize } from './zeroShot';

export interface Feedback {
  /** Unit vectors of photos the person kept (most recent first, capped). */
  kept: Float32Array[];
  /** Unit vectors of photos added to the cleanup list, per category (capped). */
  clutter: Map<string, Float32Array[]>;
  /** Decisions per category: how often its suggestions were accepted. */
  stats: Map<string, { clutter: number; keep: number }>;
  /** Total decisions taken into account. */
  decisions: number;
}

export const FEEDBACK_LIMITS = {
  /** At or above: so close to a kept photo that it isn't suggested again. */
  hideNearKept: 0.95,
  /** At or above: close to a kept photo, so less confident. */
  softenNearKept: 0.88,
  /** At or above: close to photos added to the cleanup list, so more confident. */
  boostNearClutter: 0.9,
  /** Decisions in a category before its acceptance rate is used. */
  minCategoryDecisions: 10,
  /** Below this acceptance rate a category becomes more cautious. */
  cautiousBelow: 0.6,
  /** Most recent vectors kept per set, to bound the work per photo. */
  maxPerSet: 300,
};

interface WithVec {
  vec: Float32Array;
}

export function buildFeedback(
  decisions: ReadonlyMap<string, Decision>,
  analyses: ReadonlyMap<string, WithVec>,
  limits = FEEDBACK_LIMITS,
): Feedback {
  const recent = [...decisions.values()].sort((a, b) => b.at - a.at);
  const kept: Float32Array[] = [];
  const clutter = new Map<string, Float32Array[]>();
  const stats = new Map<string, { clutter: number; keep: number }>();
  for (const d of recent) {
    const s = stats.get(d.categoryId) ?? { clutter: 0, keep: 0 };
    s[d.kind === 'clutter' ? 'clutter' : 'keep'] += 1;
    stats.set(d.categoryId, s);

    const vec = analyses.get(d.id)?.vec;
    if (!vec) continue;
    if (d.kind === 'keep') {
      if (kept.length < limits.maxPerSet) kept.push(normalize(vec));
    } else {
      const list = clutter.get(d.categoryId) ?? [];
      if (list.length < limits.maxPerSet) list.push(normalize(vec));
      clutter.set(d.categoryId, list);
    }
  }
  return { kept, clutter, stats, decisions: decisions.size };
}

function nearest(unit: Float32Array, set: readonly Float32Array[] | undefined): number {
  let best = -1;
  for (const v of set ?? []) best = Math.max(best, dot(unit, v));
  return best;
}

/** Nearest similarities per photo, cached per feedback snapshot (photos are only compared once). */
const cache = new WeakMap<Feedback, WeakMap<Float32Array, { kept: number; unit: Float32Array }>>();

function sims(fb: Feedback, vec: Float32Array) {
  let perFb = cache.get(fb);
  if (!perFb) {
    perFb = new WeakMap();
    cache.set(fb, perFb);
  }
  let hit = perFb.get(vec);
  if (!hit) {
    const unit = normalize(vec);
    hit = { kept: nearest(unit, fb.kept), unit };
    perFb.set(vec, hit);
  }
  return hit;
}

/** Adjusts one suggestion using the feedback; null when it should not be suggested. */
export function applyFeedback(
  score: CategoryScore,
  vec: Float32Array | undefined,
  fb: Feedback,
  limits = FEEDBACK_LIMITS,
): CategoryScore | null {
  let value = score.score;
  const reasons = [...score.reasons];

  if (vec) {
    const s = sims(fb, vec);
    if (s.kept >= limits.hideNearKept) return null;
    if (s.kept >= limits.softenNearKept) {
      value -= 0.15;
      reasons.push('Similar to photos you kept');
    } else if (nearest(s.unit, fb.clutter.get(score.categoryId)) >= limits.boostNearClutter) {
      value += 0.1 * (1 - value);
      reasons.push('Similar to photos you added before');
    }
  }

  const stat = fb.stats.get(score.categoryId);
  const total = (stat?.clutter ?? 0) + (stat?.keep ?? 0);
  if (stat && total >= limits.minCategoryDecisions) {
    const rate = stat.clutter / total;
    if (rate < limits.cautiousBelow) value -= (limits.cautiousBelow - rate) * 0.5;
    else if (rate > 0.9) value += 0.05 * (1 - value);
  }

  return { ...score, score: Math.max(0, Math.min(1, value)), reasons };
}

/** Wraps a classifier so every suggestion is adjusted by the person's decisions. */
export function withFeedback(
  base: Classifier,
  fb: Feedback,
  analyses: ReadonlyMap<string, WithVec>,
): Classifier {
  if (fb.decisions === 0) return base;
  return {
    score(item, now) {
      const vec = analyses.get(item.id)?.vec;
      return base.score(item, now).flatMap((s) => {
        const adjusted = applyFeedback(s, vec, fb);
        return adjusted ? [adjusted] : [];
      });
    },
  };
}
