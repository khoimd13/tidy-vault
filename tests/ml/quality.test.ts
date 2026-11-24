import { describe, expect, it } from 'vitest';
import {
  isEmptyImage,
  measureQuality,
  poorQualityScore,
  qualityReason,
} from '../../src/ml/quality';

const W = 64;
const H = 64;

function image(fn: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = fn(x, y);
  return out;
}

/** Simple box blur, to compare an image with a blurred copy of itself. */
function blur(img: Uint8Array, radius: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          const yy = Math.min(H - 1, Math.max(0, y + dy));
          s += img[yy * W + xx] ?? 0;
          n += 1;
        }
      }
      out[y * W + x] = s / n;
    }
  }
  return out;
}

const checker = image((x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 220 : 40));

describe('measureQuality', () => {
  it('rates a detailed image much sharper than a blurred copy', () => {
    const sharp = measureQuality(checker, W, H);
    const soft = measureQuality(blur(checker, 3), W, H);
    expect(sharp.sharpness).toBeGreaterThan(soft.sharpness * 10);
  });

  it('measures brightness and contrast', () => {
    const flat = measureQuality(
      image(() => 128),
      W,
      H,
    );
    expect(flat.brightness).toBeCloseTo(128);
    expect(flat.contrast).toBeCloseTo(0);
    expect(flat.sharpness).toBeCloseTo(0);
  });

  it('handles tiny or broken input', () => {
    expect(measureQuality(new Uint8Array(4), 2, 2).sharpness).toBe(0);
  });
});

describe('poorQualityScore and qualityReason (thresholds from real-image calibration)', () => {
  const q = (sharpness: number, brightness: number, contrast: number) => ({
    sharpness,
    brightness,
    contrast,
  });

  it('leaves sharp photos, smooth artwork and dark-mode screenshots alone', () => {
    expect(poorQualityScore(q(900, 120, 60))).toBe(0);
    expect(poorQualityScore(q(60, 140, 45))).toBe(0); // smooth abstract wallpaper
    expect(poorQualityScore(q(600, 23, 20))).toBe(0); // dark-mode screenshot
    expect(poorQualityScore(q(2000, 240, 15))).toBe(0); // white web page with text
    expect(qualityReason(q(900, 120, 60))).toBeNull();
  });

  it('flags blurry, very dark, flat and washed-out images with a reason', () => {
    expect(poorQualityScore(q(3, 120, 50))).toBe(1);
    expect(qualityReason(q(3, 120, 50))).toBe('Very blurry');
    expect(qualityReason(q(25, 120, 50))).toBe('Looks blurry');
    expect(qualityReason(q(32, 15, 8))).toBe('Very dark'); // underexposed, detail still there
    expect(poorQualityScore(q(32, 15, 8))).toBe(1);
    expect(qualityReason(q(0, 130, 2))).toBe('Almost nothing visible');
    expect(qualityReason(q(10, 245, 20))).toBe('Washed out');
  });

  it('agrees with measureQuality on a synthetic dark image', () => {
    const dark = measureQuality(
      image((x) => (x % 8 < 4 ? 12 : 18)),
      W,
      H,
    );
    expect(qualityReason(dark)).toBe('Very dark');
  });
});

describe('isEmptyImage', () => {
  it('is true for blank, very dark and washed-out images only', () => {
    expect(isEmptyImage({ sharpness: 0, brightness: 250, contrast: 1 })).toBe(true); // all white
    expect(isEmptyImage({ sharpness: 2, brightness: 10, contrast: 3 })).toBe(true); // all black
    expect(isEmptyImage({ sharpness: 3, brightness: 120, contrast: 50 })).toBe(false); // blurry
    expect(isEmptyImage({ sharpness: 900, brightness: 240, contrast: 15 })).toBe(false); // web page
  });
});
