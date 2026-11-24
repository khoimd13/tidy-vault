import { describe, expect, it } from 'vitest';
import { createClipClassifier } from '../../src/ml/clipClassifier';
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
  const embeddings = new Map([
    ['shot', v(1, 0, 0, 0)],
    ['ad', v(0.2, 1, 0, 0)],
    ['person', v(0, 0, 1, 0)],
  ]);
  const classifier = createClipClassifier(bank, embeddings);

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

  it('falls back to the shape heuristic before a photo is analysed', () => {
    const [s] = classifier.score(photo('not-yet', { aspect: 9 / 19.5 }), NOW);
    expect(s?.categoryId).toBe('screenshots');
  });

  it('ignores videos', () => {
    expect(classifier.score(photo('shot', { kind: 'video' }), NOW)).toEqual([]);
  });
});
