import type { Classifier, Thresholds } from '../ml/classifier';
import { DEFAULT_THRESHOLDS, toConfidence } from '../ml/classifier';
import type { Confidence, Decision, PhotoItem, Suggestion } from '../shared/types';

/** Best category per item, skipping anything the person already decided on. */
export function buildSuggestions(
  items: readonly PhotoItem[],
  classifier: Classifier,
  decisions: ReadonlyMap<string, Decision>,
  now: Date,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const item of items) {
    if (decisions.has(item.id)) continue;
    const best = classifier
      .score(item, now)
      .reduce<ReturnType<Classifier['score']>[number] | null>(
        (a, b) => (a === null || b.score > a.score ? b : a),
        null,
      );
    if (!best) continue;
    const confidence = toConfidence(best.score, thresholds);
    if (!confidence) continue;
    out.push({
      item,
      categoryId: best.categoryId,
      score: best.score,
      confidence,
      reasons: best.reasons,
    });
  }
  return out;
}

export interface SuggestionGroup {
  categoryId: string;
  suggestions: Suggestion[];
  counts: Record<Confidence, number>;
  /** "Mostly from … to …": 10th and 90th percentile dates, or null when unknown. */
  span: { from: string; to: string } | null;
  /** Up to six of the most confident suggestions, for the card's preview strip. */
  samples: Suggestion[];
  /** The most common main reason in the group, for the card's "why" line. */
  topReason: string | null;
  /** Higher is shown first: count × average score. */
  rank: number;
}

function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (best === null || n > (counts.get(best) ?? 0)) best = v;
  }
  return best;
}

function percentile(sorted: readonly string[], p: number): string {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i] ?? '';
}

export function groupSuggestions(suggestions: readonly Suggestion[]): SuggestionGroup[] {
  const byCategory = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const list = byCategory.get(s.categoryId) ?? [];
    list.push(s);
    byCategory.set(s.categoryId, list);
  }

  const groups: SuggestionGroup[] = [];
  for (const [categoryId, list] of byCategory) {
    const counts: Record<Confidence, number> = { high: 0, medium: 0, low: 0 };
    let total = 0;
    for (const s of list) {
      counts[s.confidence] += 1;
      total += s.score;
    }
    const confident = list.filter((s) => s.confidence === 'high');
    const dates = list
      .map((s) => s.item.takenAt)
      .filter((d): d is string => d !== null)
      .sort();
    // Oldest first inside a group, matching the review order in the UX plan.
    const sorted = [...list].sort((a, b) =>
      (a.item.takenAt ?? '9999').localeCompare(b.item.takenAt ?? '9999'),
    );
    groups.push({
      categoryId,
      suggestions: sorted,
      counts,
      span: dates.length ? { from: percentile(dates, 0.1), to: percentile(dates, 0.9) } : null,
      // Explain the group by its confident members; weak matches shouldn't set the headline.
      topReason: mostCommon(
        (confident.length ? confident : list).flatMap((s) => s.reasons.slice(0, 1)),
      ),
      samples: [...list].sort((a, b) => b.score - a.score).slice(0, 6),
      rank: total,
    });
  }
  return groups.sort((a, b) => b.rank - a.rank);
}
