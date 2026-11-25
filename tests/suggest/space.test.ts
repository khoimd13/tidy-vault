import { describe, expect, it } from 'vitest';
import type { Suggestion } from '../../src/shared/types';
import {
  estimateBytes,
  formatApproxSize,
  formatExactSize,
  measureSpace,
} from '../../src/suggest/space';
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

describe('measureSpace', () => {
  it('prefers storage taken, then file size, then the estimate, and says when it is exact', () => {
    const list = [s('a', 'screenshots'), s('b', 'blurry'), s('a', 'duplicates')];
    const partial = measureSpace(list, new Map([['a', { size: 900_000, spaceTaken: 0 }]]));
    // 'a' counts 0 (free under the old high-quality mode), 'b' falls back to 2.5 MB estimate.
    expect(partial).toEqual({ bytes: 2_500_000, exact: false, known: 1, total: 2 });
    const full = measureSpace(
      list,
      new Map([
        ['a', { size: 900_000, spaceTaken: null }],
        ['b', { size: 3_100_000, spaceTaken: 3_100_000 }],
      ]),
    );
    expect(full).toEqual({ bytes: 4_000_000, exact: true, known: 2, total: 2 });
  });
});

describe('formatExactSize', () => {
  it('formats real numbers without "≈"', () => {
    expect(formatExactSize(2_430_000_000, 'en')).toBe('2.4 GB');
    expect(formatExactSize(384_400_000, 'en')).toBe('384 MB');
    expect(formatExactSize(3_250_000, 'en')).toBe('3.3 MB');
    expect(formatExactSize(420_000, 'en')).toBe('420 KB');
    expect(formatExactSize(0, 'en')).toBe('0 MB');
  });
});
