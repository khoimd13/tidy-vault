import { describe, expect, it } from 'vitest';
import type { Decision } from '../../src/shared/types';
import { buildCleanupList, toCsv } from '../../src/suggest/cleanupList';
import { photo } from '../fixtures';

const d = (id: string, kind: Decision['kind'], categoryId = 'screenshots'): [string, Decision] => [
  id,
  { id, kind, categoryId, at: 0 },
];

describe('buildCleanupList', () => {
  it('keeps only clutter decisions, grouped by category and oldest first', () => {
    const items = [
      photo('a', { takenAt: '2023-01-01' }),
      photo('b', { takenAt: '2020-01-01' }),
      photo('k'),
      photo('s'),
      photo('u'),
    ];
    const decisions = new Map([
      d('a', 'clutter'),
      d('b', 'clutter'),
      d('k', 'keep'),
      d('s', 'clutter', 'shopping'),
    ]);
    const list = buildCleanupList(items, decisions);
    expect([...list.keys()]).toEqual(['screenshots', 'shopping']);
    expect(list.get('screenshots')?.map((e) => e.item.id)).toEqual(['b', 'a']);
  });
});

describe('toCsv', () => {
  it('writes a header and escapes awkward values', () => {
    const csv = toCsv([
      { item: photo('a', { takenAt: null }), decision: d('a', 'clutter')[1] },
      { item: photo('b', { url: 'https://x/"q",1' }), decision: d('b', 'clutter')[1] },
    ]);
    expect(csv).toBe(
      'id,link,date,category\n' +
        'a,https://photos.google.com/photo/a,,screenshots\n' +
        'b,"https://x/""q"",1",2021-03-03,screenshots\n',
    );
  });
});
