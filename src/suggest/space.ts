/**
 * "Space you could free" — an ESTIMATE. Google Photos doesn't show file sizes on the page, so
 * sizes are typical values per kind of photo (phone JPEG/HEIC camera photos ≈ 2.5 MB, screenshots
 * and saved images ≈ 0.5 MB). The UI always labels the result as approximate.
 */
import type { Suggestion } from '../shared/types';

/** Typical bytes per photo, by category. */
export const TYPICAL_BYTES: Record<string, number> = {
  screenshots: 500_000,
  shopping: 500_000,
  memes: 300_000,
  documents: 2_500_000,
  notes: 2_500_000,
  blurry: 2_500_000,
  accidental: 2_500_000,
  duplicates: 2_500_000,
};
const DEFAULT_BYTES = 2_000_000;

/** Estimated bytes for a set of suggestions, counting each photo once. */
export function estimateBytes(suggestions: readonly Suggestion[]): number {
  const seen = new Map<string, number>();
  for (const s of suggestions) {
    const size = TYPICAL_BYTES[s.categoryId] ?? DEFAULT_BYTES;
    // A photo in several groups is counted once, at its smallest typical size (conservative).
    seen.set(s.item.id, Math.min(seen.get(s.item.id) ?? Infinity, size));
  }
  let total = 0;
  for (const size of seen.values()) total += size;
  return total;
}

/** "≈ 2.4 GB", "≈ 380 MB"; rounded so it never looks more precise than it is. */
export function formatApproxSize(bytes: number, locale?: string): string {
  const fmt = (n: number, digits: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: digits });
  if (bytes >= 1e9) return `≈ ${fmt(bytes / 1e9, 1)} GB`;
  if (bytes >= 1e8) return `≈ ${fmt(Math.round(bytes / 1e7) * 10, 0)} MB`;
  if (bytes >= 1e6) return `≈ ${fmt(Math.round(bytes / 1e6), 0)} MB`;
  return '< 1 MB';
}
