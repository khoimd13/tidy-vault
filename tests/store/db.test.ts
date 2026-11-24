import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as store from '../../src/store/db';
import { photo } from '../fixtures';

describe('store', () => {
  beforeEach(async () => {
    await store.clearAll();
  });

  it('saves items without duplicates', async () => {
    await store.putItems([photo('a'), photo('b')]);
    await store.putItems([photo('a', { takenAt: '2020-01-01' })]);
    const all = await store.getAllItems();
    expect(all.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(all.find((i) => i.id === 'a')?.takenAt).toBe('2020-01-01');
  });

  it('saves, reads and undoes decisions', async () => {
    await store.putDecisions([
      { id: 'a', kind: 'clutter', categoryId: 'screenshots', at: 1 },
      { id: 'b', kind: 'keep', categoryId: 'screenshots', at: 2 },
    ]);
    expect([...(await store.getDecisions()).keys()].sort()).toEqual(['a', 'b']);
    await store.removeDecisions(['a']);
    expect([...(await store.getDecisions()).keys()]).toEqual(['b']);
  });
});
