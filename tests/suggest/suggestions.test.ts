import { describe, expect, it } from 'vitest';
import type { Classifier } from '../../src/ml/classifier';
import type { Decision } from '../../src/shared/types';
import { buildSuggestions, groupSuggestions } from '../../src/suggest/suggestions';
import { photo } from '../fixtures';

const NOW = new Date('2026-11-24T00:00:00Z');

/** Scores taken from a lookup table: id -> [category, score][] */
function tableClassifier(table: Record<string, [string, number][]>): Classifier {
  return {
    score: (item) =>
      (table[item.id] ?? []).map(([categoryId, score]) => ({ categoryId, score, reasons: ['r'] })),
  };
}

describe('buildSuggestions', () => {
  const classifier = tableClassifier({
    a: [['screenshots', 0.9]],
    b: [
      ['screenshots', 0.5],
      ['shopping', 0.7],
    ],
    c: [['screenshots', 0.1]],
    d: [['screenshots', 0.95]],
  });
  const items = ['a', 'b', 'c', 'd'].map((id) => photo(id));

  it('keeps the best category per item and drops weak scores', () => {
    const out = buildSuggestions(items, classifier, new Map(), NOW);
    expect(out.map((s) => [s.item.id, s.categoryId, s.confidence])).toEqual([
      ['a', 'screenshots', 'high'],
      ['b', 'shopping', 'medium'],
      ['d', 'screenshots', 'high'],
    ]);
  });

  it('skips items the person already decided on', () => {
    const decisions = new Map<string, Decision>([
      ['a', { id: 'a', kind: 'keep', categoryId: 'screenshots', at: 0 }],
      ['d', { id: 'd', kind: 'clutter', categoryId: 'screenshots', at: 0 }],
    ]);
    const out = buildSuggestions(items, classifier, decisions, NOW);
    expect(out.map((s) => s.item.id)).toEqual(['b']);
  });
});

describe('groupSuggestions', () => {
  it('groups by category, counts levels, sorts oldest first and ranks big groups first', () => {
    const classifier = tableClassifier({
      a: [['screenshots', 0.9]],
      b: [['screenshots', 0.65]],
      c: [['screenshots', 0.85]],
      s: [['shopping', 0.9]],
    });
    const items = [
      photo('a', { takenAt: '2023-01-01' }),
      photo('b', { takenAt: '2021-06-01' }),
      photo('c', { takenAt: null }),
      photo('s', { takenAt: '2022-01-01' }),
    ];
    const groups = groupSuggestions(buildSuggestions(items, classifier, new Map(), NOW));

    expect(groups.map((g) => g.categoryId)).toEqual(['screenshots', 'shopping']);
    const [shots] = groups;
    expect(shots?.counts).toEqual({ high: 2, medium: 1, low: 0 });
    expect(shots?.suggestions.map((s) => s.item.id)).toEqual(['b', 'a', 'c']);
    expect(shots?.span).toEqual({ from: '2021-06-01', to: '2023-01-01' });
    expect(shots?.topReason).toBe('r');
  });
});
