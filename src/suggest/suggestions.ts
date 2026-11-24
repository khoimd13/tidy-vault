import type { Classifier, Thresholds } from '../ml/classifier';
import { DEFAULT_THRESHOLDS, toConfidence } from '../ml/classifier';
import type { CategoryScore, Confidence, Decision, PhotoItem, Suggestion } from '../shared/types';

/**
 * One suggestion per (photo, category) that scores high enough, so a photo can appear in several
 * groups; each copy lists the other groups in `alsoIn`. Photos the person already decided on are
 * skipped (a decision in any group covers all of them).
 */
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
    // Strongest per category, then keep the ones confident enough to suggest.
    const perCategory = new Map<string, CategoryScore>();
    for (const s of classifier.score(item, now)) {
      const prev = perCategory.get(s.categoryId);
      if (!prev || s.score > prev.score) perCategory.set(s.categoryId, s);
    }
    const kept = [...perCategory.values()].flatMap((s) => {
      const confidence = toConfidence(s.score, thresholds);
      return confidence ? [{ s, confidence }] : [];
    });
    for (const { s, confidence } of kept) {
      const alsoIn = kept.map((k) => k.s.categoryId).filter((id) => id !== s.categoryId);
      out.push({
        item,
        categoryId: s.categoryId,
        score: s.score,
        confidence,
        reasons: s.reasons,
        ...(s.relatedId ? { relatedId: s.relatedId } : {}),
        ...(alsoIn.length ? { alsoIn } : {}),
      });
    }
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
