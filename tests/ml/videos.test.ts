import { describe, expect, it } from 'vitest';
import { toConfidence } from '../../src/ml/classifier';
import { videoScores } from '../../src/ml/videos';
import type { ZeroShotResult } from '../../src/ml/zeroShot';
import { photo } from '../fixtures';

const video = (durationSec: number | null) => photo('v', { kind: 'video', durationSec });
const results = (probs: Record<string, number>): ZeroShotResult[] =>
  Object.entries(probs).map(([categoryId, prob]) => ({ categoryId, prob, bestPrompt: '' }));
const sharp = { sharpness: 500, brightness: 120, contrast: 60 };
const black = { sharpness: 1, brightness: 8, contrast: 2 };

describe('videoScores', () => {
  it('ignores photos', () => {
    expect(videoScores(photo('p'), null)).toEqual([]);
  });

  it('offers very short clips, more confidently when they look accidental', () => {
    const [plain] = videoScores(video(2), { results: results({}), quality: sharp });
    expect(plain?.categoryId).toBe('shortVideos');
    expect(toConfidence(plain?.score ?? 0)).toBe('medium');
    expect(plain?.reasons).toEqual(['Only 2 seconds long']);

    const [dark] = videoScores(video(1), { results: results({}), quality: black });
    expect(toConfidence(dark?.score ?? 0)).toBe('high');
    expect(dark?.reasons).toContain('Looks recorded by accident');
  });

  it('spots screen recordings from the cover frame', () => {
    const scores = videoScores(video(40), {
      results: results({ screenshots: 0.8 }),
      quality: sharp,
    });
    expect(scores.map((s) => s.categoryId)).toEqual(['screenRecordings']);
  });

  it('lists long videos at Low only (never preselected)', () => {
    const [long] = videoScores(video(600), { results: results({}), quality: sharp });
    expect(long).toMatchObject({ categoryId: 'longVideos', reasons: ['Long video (10 min)'] });
    expect(toConfidence(long?.score ?? 0)).toBe('low');
  });

  it('suggests nothing for an ordinary video or an unknown length', () => {
    expect(videoScores(video(30), { results: results({}), quality: sharp })).toEqual([]);
    expect(videoScores(video(null), null)).toEqual([]);
  });
});
