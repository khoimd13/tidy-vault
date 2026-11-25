import { describe, expect, it } from 'vitest';
import type { Suggestion } from '../../src/shared/types';
import { estimateBytes, formatApproxSize } from '../../src/suggest/space';
import { photo } from '../fixtures';

const s = (id: string, categoryId: string): Suggestion => ({
  item: photo(id),
  categoryId,
  score: 0.9,
  confidence: 'high',
  reasons: [],
});

describe('estimateBytes', () => {
  it('adds typical sizes and counts a photo in two groups once, at the smaller size', () => {
    expect(estimateBytes([s('a', 'screenshots'), s('b', 'blurry')])).toBe(3_000_000);
    expect(estimateBytes([s('a', 'screenshots'), s('a', 'duplicates')])).toBe(500_000);
    expect(estimateBytes([s('x', 'unknown-category')])).toBe(2_000_000);
  });

  it('sizes videos by length (≈ 1.5 MB per second), or 20 MB when unknown', () => {
    const v = (id: string, durationSec: number | null): Suggestion => ({
      ...s(id, 'longVideos'),
      item: photo(id, { kind: 'video', durationSec }),
    });
    expect(estimateBytes([v('a', 120)])).toBe(180_000_000);
    expect(estimateBytes([v('b', null)])).toBe(20_000_000);
  });
});

describe('formatApproxSize', () => {
  it('rounds to something that reads as an estimate', () => {
    expect(formatApproxSize(2_430_000_000, 'en')).toBe('≈ 2.4 GB');
    expect(formatApproxSize(384_000_000, 'en')).toBe('≈ 380 MB');
    expect(formatApproxSize(3_000_000, 'en')).toBe('≈ 3 MB');
    expect(formatApproxSize(47_400_000, 'en')).toBe('≈ 47 MB');
    expect(formatApproxSize(500_000, 'en')).toBe('< 1 MB');
    expect(formatApproxSize(2_430_000_000, 'vi')).toBe('≈ 2,4 GB');
  });
});
