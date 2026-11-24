import { describe, expect, it } from 'vitest';
import { createClipClassifier, type Analysis } from '../../src/ml/clipClassifier';
import { buildTextBank, dot, meanNormalized, normalize, zeroShot } from '../../src/ml/zeroShot';
import type { CategoryDef } from '../../src/shared/types';
import { photo } from '../fixtures';

const v = (...xs: number[]) => new Float32Array(xs);

const CATS: CategoryDef[] = [
  { id: 'shots', name: 'Shots', icon: '', prompts: ['shot a', 'shot b'], needsModel: false },
  { id: 'ads', name: 'Ads', icon: '', prompts: ['ad'], needsModel: true },
];
const KEEP = ['person', 'landscape'];
// 4-d toy space: axis 0 = screenshot-ish, 1 = ad-ish, 2 = person, 3 = landscape
const TEXT = new Map([
  ['shot a', v(1, 0.1, 0, 0)],
  ['shot b', v(1, -0.1, 0, 0)],
  ['ad', v(0, 1, 0, 0)],
  ['person', v(0, 0, 1, 0)],
  ['landscape', v(0, 0, 0, 1)],
]);
const bank = buildTextBank(CATS, KEEP, TEXT);
const NOW = new Date('2026-11-24T00:00:00Z');

describe('vector helpers', () => {
  it('normalizes and averages', () => {
    expect(dot(normalize(v(3, 4)), normalize(v(3, 4)))).toBeCloseTo(1);
    const m = meanNormalized([v(1, 0), v(0, 1)]);
    expect(m[0]).toBeCloseTo(Math.SQRT1_2);
    expect(m[1]).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('buildTextBank', () => {
  it('makes one label per category plus one per keep prompt', () => {
    expect(bank.labels.map((l) => l.categoryId)).toEqual(['shots', 'ads', null, null]);
    expect(bank.prompts).toHaveLength(3);
  });
  it('fails loudly when an embedding is missing', () => {
    expect(() => buildTextBank(CATS, ['missing'], TEXT)).toThrow('missing');
  });
});

describe('zeroShot', () => {
  it('ranks the matching category first with the closest prompt as the reason', () => {
    const [top] = zeroShot(v(1, 0.2, 0, 0), bank);
    expect(top?.categoryId).toBe('shots');
    expect(top?.bestPrompt).toBe('shot a');
    expect(top?.prob).toBeGreaterThan(0.9);
  });
  it('gives categories almost no probability for an everyday photo', () => {
    const total = zeroShot(v(0, 0, 1, 0), bank).reduce((s, r) => s + r.prob, 0);
    expect(total).toBeLessThan(0.01);
  });
});

describe('createClipClassifier', () => {
  const sharp = { sharpness: 500, brightness: 120, contrast: 60 };
  const blurry = { sharpness: 2, brightness: 120, contrast: 50 };
  const a = (vec: Float32Array, quality: Analysis['quality'] = sharp): Analysis => ({
    vec,
    quality,
  });
  const analyses = new Map<string, Analysis>([
    ['shot', a(v(1, 0, 0, 0))],
    ['ad', a(v(0.2, 1, 0, 0))],
    ['person', a(v(0, 0, 1, 0))],
    ['blurry-person', a(v(0, 0, 1, 0), blurry)],
    ['blurry-shot', a(v(1, 0, 0, 0), blurry)],
  ]);
  const classifier = createClipClassifier(bank, analyses);

  it('suggests clutter with a total-clutter score and a plain reason', () => {
    const [s] = classifier.score(photo('shot', { aspect: 9 / 19.5, takenAt: '2021-01-01' }), NOW);
    expect(s?.categoryId).toBe('shots');
    expect(s?.score).toBeGreaterThan(0.95);
    expect(s?.reasons).toEqual(['Looks like shot a', 'Phone-screen shape', 'From 2021']);
    const [ad] = classifier.score(photo('ad', { aspect: 4 / 3 }), NOW);
    expect(ad?.categoryId).toBe('ads');
  });

  it('suggests nothing for a photo that looks like a memory', () => {
    expect(classifier.score(photo('person', { aspect: 9 / 19.5 }), NOW)).toEqual([]);
  });

  it('files clearly poor images under blurry, with the measured reason first', () => {
    const [s] = classifier.score(photo('blurry-shot', { aspect: 4 / 3 }), NOW);
    expect(s?.categoryId).toBe('blurry');
    expect(s?.reasons[0]).toBe('Very blurry');
  });

  it('offers a very poor photo that looks like a memory as Medium only', () => {
    const [s] = classifier.score(photo('blurry-person', { aspect: 4 / 3, takenAt: null }), NOW);
    expect(s).toEqual({ categoryId: 'blurry', score: 0.62, reasons: ['Very blurry'] });
  });

  it('files empty images as empty (High), never as near-duplicates', () => {
    const blank = { sharpness: 0, brightness: 250, contrast: 1 };
    const withBlank = new Map(analyses).set('blank', a(v(0, 0, 1, 0), blank));
    const dups = new Map([
      ['blank', { keepId: 'other-blank', similarity: 0.99, minutesApart: 0, groupSize: 2 }],
    ]);
    const scores = createClipClassifier(bank, withBlank, undefined, dups).score(
      photo('blank', { takenAt: null }),
      NOW,
    );
    expect(scores).toEqual([
      { categoryId: 'blurry', score: 0.9, reasons: ['Almost nothing visible'] },
    ]);
  });

  it('suggests near-duplicates that are not the kept photo', () => {
    const dups = new Map([
      ['person', { keepId: 'other', similarity: 0.97, minutesApart: 1, groupSize: 2 }],
    ]);
    const withDups = createClipClassifier(bank, analyses, undefined, dups);
    const [s] = withDups.score(photo('person', { takenAt: null }), NOW);
    expect(s?.categoryId).toBe('duplicates');
    expect(s?.score).toBeCloseTo(0.9);
    expect(s?.reasons).toEqual([
      'Very similar to a photo taken 1 min apart',
      'Keeping the sharpest',
    ]);
  });

  it('falls back to the shape heuristic before a photo is analysed', () => {
    const [s] = classifier.score(photo('not-yet', { aspect: 9 / 19.5 }), NOW);
    expect(s?.categoryId).toBe('screenshots');
  });

  it('ignores videos', () => {
    expect(classifier.score(photo('shot', { kind: 'video' }), NOW)).toEqual([]);
  });
});
