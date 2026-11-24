/**
 * Near-duplicate detection (pure): photos taken close together whose image embeddings are almost
 * identical form a group. The sharpest photo of each group is kept; the others are suggested.
 */
import { dot, normalize } from './zeroShot';

export interface DuplicateInput {
  id: string;
  /** Capture time in ms, when known. */
  takenTs?: number | null | undefined;
  /** yyyy-mm-dd, used when the time is unknown. */
  takenAt: string | null;
  vec: Float32Array;
  /** Higher is sharper (see ml/quality.ts); picks which photo of a group to keep. */
  sharpness: number;
}

export interface DuplicateMatch {
  /** The photo of the group that is kept (not suggested). */
  keepId: string;
  /** Cosine similarity to the kept photo, 0..1. */
  similarity: number;
  /** Minutes between this photo and the kept one, when both times are known. */
  minutesApart: number | null;
  groupSize: number;
}

export interface DuplicateOptions {
  /** Minimum cosine similarity of CLIP image embeddings to count as "the same shot". */
  minSimilarity: number;
  /** Photos further apart than this are never grouped. */
  maxGapMs: number;
  /** How many following photos (in time order) each photo is compared with. */
  window: number;
}

/**
 * Calibrated in tests-model/duplicates.smoke.test.ts: re-framed burst shots score 0.91–0.99 (median
 * 0.965), brighter copies 0.93+, while different photos have a median of 0.70. Pairs above 0.92
 * were the same artwork in other colours or repeated screenshots, i.e. real near-duplicates.
 */
export const DEFAULT_DUPLICATE_OPTIONS: DuplicateOptions = {
  minSimilarity: 0.92,
  maxGapMs: 10 * 60 * 1000,
  window: 8,
};

/** Map from photo id to its match, for every photo that is NOT the kept one of its group. */
export function findNearDuplicates(
  inputs: readonly DuplicateInput[],
  options: DuplicateOptions = DEFAULT_DUPLICATE_OPTIONS,
): Map<string, DuplicateMatch> {
  const items = inputs
    .filter((i) => typeof i.takenTs === 'number' || i.takenAt !== null)
    .map((i) => ({ ...i, unit: normalize(i.vec), sortKey: sortKey(i) }))
    .sort((a, b) => a.sortKey - b.sortKey);

  // Union-find over close-in-time, near-identical neighbours.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      const p = parent[i] ?? i;
      parent[i] = parent[p] ?? p;
      i = p;
    }
    return i;
  };
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!a) continue;
    for (let j = i + 1; j < Math.min(items.length, i + 1 + options.window); j++) {
      const b = items[j];
      if (!b) continue;
      if (!closeInTime(a, b, options.maxGapMs)) break;
      if (dot(a.unit, b.unit) >= options.minSimilarity) parent[find(j)] = find(i);
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  const out = new Map<string, DuplicateMatch>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const keep = members.reduce((best, i) =>
      (items[i]?.sharpness ?? 0) > (items[best]?.sharpness ?? 0) ? i : best,
    );
    const kept = items[keep];
    if (!kept) continue;
    for (const i of members) {
      const item = items[i];
      if (!item || i === keep) continue;
      const bothTimed = typeof item.takenTs === 'number' && typeof kept.takenTs === 'number';
      out.set(item.id, {
        keepId: kept.id,
        similarity: dot(item.unit, kept.unit),
        minutesApart: bothTimed
          ? Math.round(Math.abs((item.takenTs ?? 0) - (kept.takenTs ?? 0)) / 60000)
          : null,
        groupSize: members.length,
      });
    }
  }
  return out;
}

function sortKey(i: DuplicateInput): number {
  if (typeof i.takenTs === 'number') return i.takenTs;
  return i.takenAt ? Date.parse(`${i.takenAt}T12:00:00Z`) : 0;
}

/** Same moment: within maxGap when both times are known, otherwise the same day. */
function closeInTime(a: DuplicateInput, b: DuplicateInput, maxGapMs: number): boolean {
  if (typeof a.takenTs === 'number' && typeof b.takenTs === 'number')
    return Math.abs(b.takenTs - a.takenTs) <= maxGapMs;
  return a.takenAt !== null && a.takenAt === b.takenAt;
}

/** Suggestion confidence from similarity: 0.92 → 0.6 (Medium) … 0.97+ → 0.9+ (High). */
export function duplicateScore(similarity: number): number {
  return Math.min(0.97, Math.max(0, 0.6 + ((similarity - 0.92) / 0.05) * 0.3));
}
