/**
 * Image quality from a small grayscale thumbnail (pure maths, no model).
 *
 * - sharpness: variance of the Laplacian, the classic focus measure. Blurry images have little
 *   fine detail, so neighbouring pixels differ little and the variance is low.
 * - brightness: mean gray level, 0..255.
 * - contrast: standard deviation of gray levels.
 */

export interface Quality {
  sharpness: number;
  brightness: number;
  contrast: number;
}

/** Computes quality for a `width × height` grayscale image (one byte per pixel, row-major). */
export function measureQuality(gray: ArrayLike<number>, width: number, height: number): Quality {
  if (width < 3 || height < 3 || gray.length < width * height) {
    return { sharpness: 0, brightness: 0, contrast: 0 };
  }
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < width * height; i++) {
    const v = gray[i] ?? 0;
    sum += v;
    sumSq += v * v;
  }
  const n = width * height;
  const brightness = sum / n;
  const contrast = Math.sqrt(Math.max(0, sumSq / n - brightness * brightness));

  // 4-neighbour Laplacian over the interior pixels.
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        (gray[i - width] ?? 0) +
        (gray[i + width] ?? 0) +
        (gray[i - 1] ?? 0) +
        (gray[i + 1] ?? 0) -
        4 * (gray[i] ?? 0);
      lapSum += lap;
      lapSq += lap * lap;
      count += 1;
    }
  }
  const lapMean = lapSum / count;
  const sharpness = lapSq / count - lapMean * lapMean;
  return { sharpness, brightness, contrast };
}

/**
 * Thresholds on a 224 px thumbnail. Calibrated in tests-model/quality.smoke.test.ts: sharp photos
 * and their artificially blurred copies separate cleanly around these values.
 */
export const QUALITY_LIMITS = {
  /** At or below: clearly blurry. Blurred real photos measure 0–5, sharp ones 50+. */
  blurryAt: 12,
  /** At or above: clearly sharp. Smooth artwork and soft photos sit around 35–100. */
  sharpAt: 50,
  /** Mean gray at or below (with little detail): too dark to see much. */
  darkAt: 35,
  /** Mean gray at or above (with little contrast): washed out. */
  brightAt: 235,
  /** Std-dev at or below (with little detail): flat, almost a single colour. */
  flatAt: 12,
  /** Sharpness below which an image has "little detail" for the dark/flat/washed rules. */
  littleDetail: 30,
};

/** 0 (fine) .. 1 (clearly poor): how blurry, dark, washed-out or flat the image looks. */
export function poorQualityScore(q: Quality, limits = QUALITY_LIMITS): number {
  const blur = clamp01((limits.sharpAt - q.sharpness) / (limits.sharpAt - limits.blurryAt));
  // Dark-mode screenshots, night shots and white pages are full of detail: only count darkness,
  // flatness and washed-out images when there is little detail too.
  const detailless = q.sharpness < limits.littleDetail;
  // Too dark to see: dim and either little detail or little contrast left (an underexposed shot).
  // Dark-mode screenshots stay safe: measured 12–20+, darkened photos 5–11.
  const dim = detailless || q.contrast < 12;
  const dark = dim ? clamp01((limits.darkAt + 25 - q.brightness) / 25) : 0;
  const washed = detailless && q.brightness >= limits.brightAt && q.contrast < 30 ? 1 : 0;
  const flat = detailless ? clamp01((limits.flatAt + 10 - q.contrast) / 10) : 0;
  return Math.max(blur, dark, washed, flat);
}

/** What makes the image poor, in plain words, or null when it looks fine. */
export function qualityReason(q: Quality, limits = QUALITY_LIMITS): string | null {
  const detailless = q.sharpness < limits.littleDetail;
  if ((detailless || q.contrast < 12) && q.brightness <= limits.darkAt) return 'Very dark';
  if (detailless && q.contrast <= limits.flatAt) return 'Almost nothing visible';
  if (detailless && q.brightness >= limits.brightAt && q.contrast < 30) return 'Washed out';
  if (q.sharpness <= limits.blurryAt) return 'Very blurry';
  if (q.sharpness < (limits.blurryAt + limits.sharpAt) / 2) return 'Looks blurry';
  return null;
}

/**
 * True when there is essentially nothing to see (blank, very dark or washed out), as opposed to a
 * blurry photo that still shows something. Empty images are clutter whatever the model thinks,
 * and are never treated as near-duplicates of each other.
 */
export function isEmptyImage(q: Quality, limits = QUALITY_LIMITS): boolean {
  const reason = qualityReason(q, limits);
  return reason === 'Almost nothing visible' || reason === 'Very dark' || reason === 'Washed out';
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
