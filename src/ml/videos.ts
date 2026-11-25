/**
 * Video suggestions (pure). Videos are judged by their length and their cover frame:
 * - very short clips (≤ 3 s) are usually accidental: Medium, or High when the cover frame is
 *   empty/dark or looks accidental;
 * - a cover frame that looks like a screen means a screen recording;
 * - long videos (≥ 2 min) take the most space but are often precious: Low only, never preselected.
 */
import type { CategoryScore, PhotoItem } from '../shared/types';
import { isEmptyImage, type Quality } from './quality';
import type { ZeroShotResult } from './zeroShot';

export const VIDEO_LIMITS = {
  shortMaxSec: 3,
  longMinSec: 120,
  /** Cover-frame "screenshot" probability needed to call it a screen recording. */
  screenRecording: 0.5,
};

export function videoScores(
  item: PhotoItem,
  cover: { results: ZeroShotResult[]; quality: Quality | null } | null,
  limits = VIDEO_LIMITS,
): CategoryScore[] {
  if (item.kind !== 'video') return [];
  const out: CategoryScore[] = [];
  const seconds = item.durationSec ?? null;
  const prob = (id: string) => cover?.results.find((r) => r.categoryId === id)?.prob ?? 0;
  const looksAccidental =
    (cover?.quality ? isEmptyImage(cover.quality) : false) ||
    prob('accidental') + prob('blurry') >= 0.4;

  if (seconds !== null && seconds <= limits.shortMaxSec) {
    const reasons = [`Only ${seconds} seconds long`];
    if (looksAccidental) reasons.push('Looks recorded by accident');
    out.push({ categoryId: 'shortVideos', score: looksAccidental ? 0.88 : 0.66, reasons });
  }

  const screen = prob('screenshots') + prob('shopping');
  if (screen >= limits.screenRecording) {
    out.push({
      categoryId: 'screenRecordings',
      score: Math.min(0.95, 0.4 + screen * 0.55),
      reasons: ['Looks like a screen recording'],
    });
  }

  if (seconds !== null && seconds >= limits.longMinSec) {
    out.push({
      categoryId: 'longVideos',
      score: 0.45,
      reasons: [`Long video (${Math.round(seconds / 60)} min)`],
    });
  }
  return out;
}
