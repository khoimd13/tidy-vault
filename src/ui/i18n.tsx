/**
 * Interface languages (see locales/). Everything the person reads goes through `t()`; category
 * names and the classifier's (English) reasons are translated here for display.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { en } from './locales/en';
import { findLocale, LOCALES, matchLocale } from './locales/index';
import type { Key, Locale } from './locales/types';

export { LOCALES };
export type { Locale };

export function interpolate(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translates one classifier reason (they are produced in English). */
export function translateReason(reason: string, loc: Locale): string {
  if (loc.code === en.code) return reason;
  const fixed = loc.reasons[reason];
  if (fixed) return fixed;
  const tpl = loc.templates;
  const looks = /^Looks like (.+)$/.exec(reason);
  if (looks?.[1]) {
    const prompt = looks[1].charAt(0).toLowerCase() + looks[1].slice(1);
    return interpolate(tpl.looksLike, { what: loc.prompts[prompt] ?? prompt });
  }
  const short = /^Only (\d+) seconds long$/.exec(reason);
  if (short?.[1]) return interpolate(tpl.onlySeconds, { n: short[1] });
  const long = /^Long video \((\d+) min\)$/.exec(reason);
  if (long?.[1]) return interpolate(tpl.longVideo, { n: long[1] });
  const from = /^From (\d{4})$/.exec(reason);
  if (from?.[1]) return interpolate(tpl.fromYear, { year: from[1] });
  const similar = /^Very similar to a photo taken (.+)$/.exec(reason);
  if (similar?.[1]) {
    const min = /^(\d+) min apart$/.exec(similar[1]);
    if (min?.[1]) return interpolate(tpl.similarMinutes, { n: min[1] });
    if (similar[1] === 'the same day') return tpl.similarSameDay;
    return interpolate(tpl.similarOther, { when: similar[1] });
  }
  return reason;
}

export interface I18n {
  /** The chosen language's code (see locales/). */
  lang: string;
  locale: string;
  setLang: (code: string) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** Number formatted for the current language. */
  n: (value: number) => string;
  category: (id: string, fallback?: string) => string;
  /** A category name as it reads inside a sentence, e.g. after a count. */
  inline: (name: string) => string;
  reason: (reason: string) => string;
}

function make(loc: Locale, setLang: (code: string) => void): I18n {
  return {
    lang: loc.code,
    locale: loc.locale,
    setLang,
    t: (key, vars) => interpolate(loc.strings[key] || en.strings[key], vars),
    n: (value) => value.toLocaleString(loc.locale),
    category: (id, fallback) => loc.categories[id] ?? fallback ?? id,
    inline: (name) => (loc.keepCase ? name : name.toLocaleLowerCase(loc.locale)),
    reason: (r) => translateReason(r, loc),
  };
}

const I18nContext = createContext<I18n>(make(en, () => undefined));

const STORAGE_KEY = 'lang';

function defaultLocale(): Locale {
  return typeof navigator === 'undefined'
    ? en
    : matchLocale(navigator.languages.length ? navigator.languages : [navigator.language]);
}

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [loc, setLoc] = useState<Locale>(defaultLocale());

  useEffect(() => {
    void chrome.storage.local.get(STORAGE_KEY).then((stored: Record<string, unknown>) => {
      const v = stored[STORAGE_KEY];
      const chosen = typeof v === 'string' ? findLocale(v) : undefined;
      if (chosen) setLoc(chosen);
    });
  }, []);

  const setLang = useCallback((code: string) => {
    const next = findLocale(code);
    if (!next) return;
    setLoc(next);
    void chrome.storage.local.set({ [STORAGE_KEY]: next.code });
  }, []);

  useEffect(() => {
    document.documentElement.lang = loc.locale;
  }, [loc]);

  const value = useMemo(() => make(loc, setLang), [loc, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
