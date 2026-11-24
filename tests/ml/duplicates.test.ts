import { describe, expect, it } from 'vitest';
import { duplicateScore, findNearDuplicates, type DuplicateInput } from '../../src/ml/duplicates';

const MIN = 60 * 1000;
const T0 = Date.UTC(2024, 10, 24, 19, 0, 0);

/** Unit vector mostly along `axis`, nudged by `noise` along the next axis. */
function vec(axis: number, noise = 0): Float32Array {
  const v = new Float32Array(8);
  v[axis] = 1;
  v[(axis + 1) % 8] = noise;
  return v;
}

function input(id: string, minutes: number, v: Float32Array, sharpness = 100): DuplicateInput {
  return { id, takenTs: T0 + minutes * MIN, takenAt: '2024-11-24', vec: v, sharpness };
}

describe('findNearDuplicates', () => {
  it('groups near-identical shots taken close together and keeps the sharpest', () => {
    const result = findNearDuplicates([
      input('a1', 0, vec(0, 0.05), 80),
      input('a2', 0.2, vec(0, 0.1), 300), // sharpest: kept
      input('a3', 0.5, vec(0, 0.15), 120),
      input('b', 1, vec(3)), // different subject
      input('c', 2, vec(5)),
    ]);
    expect([...result.keys()].sort()).toEqual(['a1', 'a3']);
    expect(result.get('a1')).toMatchObject({ keepId: 'a2', groupSize: 3, minutesApart: 0 });
    expect(result.get('a1')?.similarity).toBeGreaterThan(0.99);
  });

  it('does not group the same scene taken far apart in time', () => {
    const result = findNearDuplicates([input('x', 0, vec(0)), input('y', 60, vec(0))]);
    expect(result.size).toBe(0);
  });

  it('falls back to the same day when times are unknown', () => {
    const noTime = (id: string, day: string): DuplicateInput => ({
      id,
      takenTs: null,
      takenAt: day,
      vec: vec(2),
      sharpness: id === 'keep' ? 500 : 50,
    });
    const result = findNearDuplicates([
      noTime('keep', '2024-01-01'),
      noTime('dup', '2024-01-01'),
      noTime('other-day', '2024-01-02'),
    ]);
    expect([...result.entries()]).toEqual([
      ['dup', { keepId: 'keep', similarity: 1, minutesApart: null, groupSize: 2 }],
    ]);
  });

  it('ignores photos without any date', () => {
    const undated = { id: 'u', takenTs: null, takenAt: null, vec: vec(0), sharpness: 1 };
    expect(findNearDuplicates([undated, { ...undated, id: 'v' }]).size).toBe(0);
  });
});

describe('duplicateScore', () => {
  it('maps similarity to confidence', () => {
    expect(duplicateScore(0.92)).toBeCloseTo(0.6);
    expect(duplicateScore(0.97)).toBeCloseTo(0.9);
    expect(duplicateScore(1)).toBe(0.97);
  });
});
