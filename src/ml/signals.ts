/** Cheap, explainable signals that need no AI model. Each returns 0..1. */

/** Modern phone screens (width / height, portrait). Cameras almost never shoot these shapes. */
const PHONE_SCREENS = [9 / 18, 9 / 19.5, 9 / 20, 9 / 21];
/** Older phones (9:16) and computers (16:9, 16:10). Also common camera shapes, so weighted lower. */
const AMBIGUOUS_SCREENS = [9 / 16, 16 / 9, 16 / 10];
/** Grid tiles are rounded to whole pixels, so allow a small tolerance. */
const TOLERANCE = 0.02;

const near = (a: number, b: number) => Math.abs(a - b) / b <= TOLERANCE;

export function screenShapeScore(aspect: number | null): number {
  if (aspect === null || aspect <= 0) return 0;
  if (PHONE_SCREENS.some((r) => near(aspect, r))) return 1;
  if (AMBIGUOUS_SCREENS.some((r) => near(aspect, r))) return 0.5;
  return 0;
}

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** 0 for today, rising linearly to 1 at `fullAfterYears` old. Unknown dates score 0. */
export function ageScore(takenAt: string | null, now: Date, fullAfterYears = 3): number {
  if (!takenAt) return 0;
  const t = Date.parse(takenAt);
  if (Number.isNaN(t)) return 0;
  const years = (now.getTime() - t) / YEAR_MS;
  return Math.min(1, Math.max(0, years / fullAfterYears));
}
