import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/shared/categories';
import { interpolate, LOCALES, translateReason } from '../../src/ui/i18n';
import { en } from '../../src/ui/locales/en';
import { matchLocale } from '../../src/ui/locales/index';
import type { Key } from '../../src/ui/locales/types';
import { vi } from '../../src/ui/locales/vi';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('interpolate', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(interpolate('{n} of {b} {x}', { n: 3, b: 5 })).toBe('3 of 5 {x}');
  });
});

describe('every language', () => {
  const keys = Object.keys(en.strings) as Key[];
  const prompts = CATEGORIES.flatMap((c) => c.prompts);
  const reasons = Object.keys(vi.reasons);

  it('has unique codes and names', () => {
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(LOCALES.length);
    expect(new Set(LOCALES.map((l) => l.name)).size).toBe(LOCALES.length);
  });

  for (const loc of LOCALES.filter((l) => l !== en)) {
    describe(loc.name, () => {
      it('translates every string and keeps its placeholders', () => {
        for (const key of keys) {
          const text = loc.strings[key];
          expect(text.trim(), key).not.toBe('');
          expect(placeholders(text), key).toEqual(placeholders(en.strings[key]));
        }
      });

      it('translates every category, AI description and reason', () => {
        for (const c of CATEGORIES) expect(loc.categories[c.id], c.id).toBeTruthy();
        for (const p of prompts) expect(loc.prompts[p], p).toBeTruthy();
        for (const r of reasons) expect(loc.reasons[r], r).toBeTruthy();
      });

      it('keeps the placeholders of the reason templates', () => {
        for (const [k, text] of Object.entries(loc.templates)) {
          const source = en.templates[k as keyof typeof en.templates];
          expect(placeholders(text), k).toEqual(placeholders(source));
        }
      });

      it('formats numbers in its own locale', () => {
        expect(() => (1234.5).toLocaleString(loc.locale)).not.toThrow();
      });
    });
  }
});

describe('matchLocale', () => {
  it('picks the browser language, its base language, or English', () => {
    expect(matchLocale(['vi-VN']).code).toBe('vi');
    expect(matchLocale(['xx', 'vi']).code).toBe('vi');
    expect(matchLocale(['xx-YY']).code).toBe('en');
  });
});

describe('translateReason', () => {
  it('translates every AI description into Vietnamese', () => {
    for (const prompt of CATEGORIES.flatMap((c) => c.prompts)) {
      const text = translateReason(`Looks like ${prompt}`, vi);
      expect(text, prompt).toMatch(/^Trông giống /);
      expect(text, prompt).not.toContain(prompt);
    }
  });

  it('translates fixed and templated reasons, and leaves English alone', () => {
    expect(translateReason('Very blurry', vi)).toBe('Rất mờ');
    expect(translateReason('From 2021', vi)).toBe('Từ năm 2021');
    expect(translateReason('Very similar to a photo taken 3 min apart', vi)).toBe(
      'Rất giống một ảnh chụp cách 3 phút',
    );
    expect(translateReason('Very similar to a photo taken the same day', vi)).toBe(
      'Rất giống một ảnh chụp cùng ngày',
    );
    expect(translateReason('Very blurry', en)).toBe('Very blurry');
  });
});
