/** Every interface language, in picker order: English, then Asia to Europe. */
import { en } from './en';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { id } from './id';
import { ja } from './ja';
import { ko } from './ko';
import { pt } from './pt';
import { ru } from './ru';
import { th } from './th';
import { vi } from './vi';
import { zh } from './zh';
import type { Locale } from './types';

export const LOCALES: readonly Locale[] = [en, vi, th, id, zh, ja, ko, ru, de, fr, es, pt];

export function findLocale(code: string): Locale | undefined {
  return LOCALES.find((l) => l.code === code);
}

/** The best match for the browser's languages, else English. */
export function matchLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    const exact = LOCALES.find((l) => l.locale.toLowerCase() === lower || l.code === lower);
    if (exact) return exact;
    const base = LOCALES.find((l) => l.code === lower.split('-')[0]);
    if (base) return base;
  }
  return en;
}
