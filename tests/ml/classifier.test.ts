import { describe, expect, it } from 'vitest';
import { heuristicClassifier, toConfidence } from '../../src/ml/classifier';
import { ageScore, screenShapeScore } from '../../src/ml/signals';
import { photo } from '../fixtures';

const NOW = new Date('2026-11-24T00:00:00Z');

describe('screenShapeScore', () => {
  it('scores phone screens highest, desktop screens lower, camera photos zero', () => {
    expect(screenShapeScore(9 / 19.5)).toBe(1);
    expect(screenShapeScore(9 / 20 + 0.005)).toBe(1);
    expect(screenShapeScore(9 / 16)).toBe(0.5);
    expect(screenShapeScore(16 / 9)).toBe(0.5);
    expect(screenShapeScore(3 / 4)).toBe(0);
    expect(screenShapeScore(4 / 3)).toBe(0);
    expect(screenShapeScore(null)).toBe(0);
  });
});

describe('ageScore', () => {
  it('rises from 0 today to 1 after three years', () => {
    expect(ageScore('2026-11-24', NOW)).toBe(0);
    expect(ageScore('2025-05-24', NOW)).toBeCloseTo(0.5, 1);
    expect(ageScore('2010-01-01', NOW)).toBe(1);
    expect(ageScore(null, NOW)).toBe(0);
  });
});

describe('toConfidence', () => {
  it('maps scores to levels and drops weak ones', () => {
    expect(toConfidence(0.9)).toBe('high');
    expect(toConfidence(0.7)).toBe('medium');
    expect(toConfidence(0.45)).toBe('low');
    expect(toConfidence(0.2)).toBeNull();
  });
});

describe('heuristicClassifier', () => {
  it('flags old phone-shaped photos as high-confidence screenshots with reasons', () => {
    const [s] = heuristicClassifier.score(photo('a', { takenAt: '2021-03-03' }), NOW);
    expect(s?.categoryId).toBe('screenshots');
    expect(toConfidence(s?.score ?? 0)).toBe('high');
    expect(s?.reasons).toEqual(['Phone-screen shape', 'From 2021']);
  });

  it('never rates ambiguous screen shapes as High', () => {
    const [s] = heuristicClassifier.score(
      photo('w', { aspect: 16 / 9, takenAt: '2010-01-01' }),
      NOW,
    );
    expect(toConfidence(s?.score ?? 0)).toBe('medium');
  });

  it('ignores videos and normal camera photos', () => {
    expect(heuristicClassifier.score(photo('v', { kind: 'video' }), NOW)).toEqual([]);
    expect(heuristicClassifier.score(photo('c', { aspect: 3 / 4 }), NOW)).toEqual([]);
  });
});
