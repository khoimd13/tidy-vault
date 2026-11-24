import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/shared/categories';
import { interpolate, translateReason } from '../../src/ui/i18n';

describe('interpolate', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(interpolate('{n} of {b} {x}', { n: 3, b: 5 })).toBe('3 of 5 {x}');
  });
});

describe('translateReason', () => {
  it('translates every AI description into Vietnamese', () => {
    for (const prompt of CATEGORIES.flatMap((c) => c.prompts)) {
      const reason = `Looks like ${prompt}`;
      const vi = translateReason(reason, 'vi');
      expect(vi, prompt).toMatch(/^Trông giống /);
      expect(vi, prompt).not.toContain(prompt);
    }
  });

  it('translates fixed and templated reasons, and leaves English alone', () => {
    expect(translateReason('Very blurry', 'vi')).toBe('Rất mờ');
    expect(translateReason('From 2021', 'vi')).toBe('Từ năm 2021');
    expect(translateReason('Very similar to a photo taken 3 min apart', 'vi')).toBe(
      'Rất giống một ảnh chụp cách 3 phút',
    );
    expect(translateReason('Very similar to a photo taken the same day', 'vi')).toBe(
      'Rất giống một ảnh chụp cùng ngày',
    );
    expect(translateReason('Very blurry', 'en')).toBe('Very blurry');
  });
});
