import { describe, expect, it } from 'vitest';
import type { Classifier } from '../../src/ml/classifier';
import { applyFeedback, buildFeedback, withFeedback } from '../../src/ml/feedback';
import type { CategoryScore, Decision } from '../../src/shared/types';
import { photo } from '../fixtures';

const NOW = new Date('2026-11-25T00:00:00Z');

function vec(axis: number, noise = 0): Float32Array {
  const v = new Float32Array(8);
  v[axis] = 1;
  v[(axis + 1) % 8] = noise;
  return v;
}

const decision = (id: string, kind: Decision['kind'], categoryId = 'shots', at = 1): Decision => ({
  id,
  kind,
  categoryId,
  at,
});

const score = (value: number, categoryId = 'shots'): CategoryScore => ({
  categoryId,
  score: value,
  reasons: ['Looks like x'],
});

describe('buildFeedback', () => {
  it('collects kept and clutter vectors and per-category counts', () => {
    const fb = buildFeedback(
      new Map([
        ['k', decision('k', 'keep')],
        ['c', decision('c', 'clutter')],
        ['no-vec', decision('no-vec', 'clutter')],
      ]),
      new Map([
        ['k', { vec: vec(0) }],
        ['c', { vec: vec(1) }],
      ]),
    );
    expect(fb.kept).toHaveLength(1);
    expect(fb.clutter.get('shots')).toHaveLength(1);
    expect(fb.stats.get('shots')).toEqual({ clutter: 2, keep: 1 });
    expect(fb.decisions).toBe(3);
  });
});

describe('applyFeedback', () => {
  const fb = buildFeedback(
    new Map([
      ['k', decision('k', 'keep')],
      ['c', decision('c', 'clutter')],
    ]),
    new Map([
      ['k', { vec: vec(0) }],
      ['c', { vec: vec(2) }],
    ]),
  );

  it('hides photos nearly identical to one you kept', () => {
    expect(applyFeedback(score(0.9), vec(0, 0.05), fb)).toBeNull();
  });

  it('softens photos similar to one you kept', () => {
    const r = applyFeedback(score(0.9), vec(0, 0.4), fb);
    expect(r?.score).toBeCloseTo(0.75);
    expect(r?.reasons).toContain('Similar to photos you kept');
  });

  it('boosts photos similar to ones you added before', () => {
    const r = applyFeedback(score(0.7), vec(2, 0.1), fb);
    expect(r?.score).toBeCloseTo(0.73);
    expect(r?.reasons).toContain('Similar to photos you added before');
  });

  it('makes a category cautious when its suggestions are often rejected', () => {
    const decisions = new Map<string, Decision>();
    for (let i = 0; i < 10; i++) {
      decisions.set(`d${i}`, decision(`d${i}`, i < 3 ? 'clutter' : 'keep', 'memes'));
    }
    const cautious = buildFeedback(decisions, new Map());
    // 30% accepted → 0.8 − (0.6 − 0.3) × 0.5 = 0.65
    expect(applyFeedback(score(0.8, 'memes'), undefined, cautious)?.score).toBeCloseTo(0.65);
    // Other categories are unaffected.
    expect(applyFeedback(score(0.8, 'shots'), undefined, cautious)?.score).toBeCloseTo(0.8);
  });
});

describe('withFeedback', () => {
  const base: Classifier = { score: () => [score(0.9)] };

  it('passes through when there are no decisions', () => {
    const fb = buildFeedback(new Map(), new Map());
    expect(withFeedback(base, fb, new Map())).toBe(base);
  });

  it('drops suggestions hidden by feedback', () => {
    const fb = buildFeedback(
      new Map([['k', decision('k', 'keep')]]),
      new Map([['k', { vec: vec(0) }]]),
    );
    const c = withFeedback(base, fb, new Map([['p', { vec: vec(0, 0.01) }]]));
    expect(c.score(photo('p'), NOW)).toEqual([]);
    expect(c.score(photo('unanalysed'), NOW)).toHaveLength(1);
  });
});
