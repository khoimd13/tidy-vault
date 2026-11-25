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

describe('embeddings store', () => {
  it('keeps vectors per model and clears them with everything else', async () => {
    await store.putEmbeddings([
      { id: 'a', model: 'm1', vec: new Float32Array([1, 2]) },
      { id: 'b', model: 'm2', vec: new Float32Array([3, 4]) },
    ]);
    const m1 = await store.getEmbeddings('m1');
    expect([...m1.keys()]).toEqual(['a']);
    expect(Array.from(m1.get('a') ?? [])).toEqual([1, 2]);
    await store.clearAll();
    expect((await store.getEmbeddings('m1')).size).toBe(0);
  });
});

describe('getEmbeddingsByModel', () => {
  it('splits one read by model and ignores others', async () => {
    await store.putEmbeddings([
      { id: 'a', model: 'img', vec: new Float32Array([1]) },
      { id: 'prompt', model: 'txt', vec: new Float32Array([2]) },
      { id: 'old', model: 'other', vec: new Float32Array([3]) },
    ]);
    const byModel = await store.getEmbeddingsByModel(['img', 'txt']);
    expect([...(byModel.get('img')?.keys() ?? [])]).toEqual(['a']);
    expect([...(byModel.get('txt')?.keys() ?? [])]).toEqual(['prompt']);
    expect(byModel.has('other')).toBe(false);
  });
});

describe('thumbnail store', () => {
  it('saves thumbnails by photo id and clears them with everything else', async () => {
    await store.putThumbs([{ id: 'a', blob: new Blob(['x'], { type: 'image/jpeg' }) }]);
    expect((await store.getThumb('a'))?.size).toBe(1);
    expect(await store.getThumb('missing')).toBeNull();
    await store.clearAll();
    expect(await store.getThumb('a')).toBeNull();
  });
});

describe('one database per account', () => {
  it('keeps each database apart and comes back to the first', async () => {
    store.selectDatabase(store.DEFAULT_DB_NAME);
    await store.clearAll();
    await store.putItems([photo('mine')]);
    store.selectDatabase('vault-tidy:other');
    expect(await store.getAllItems()).toEqual([]);
    await store.putItems([photo('theirs')]);
    store.selectDatabase(store.DEFAULT_DB_NAME);
    expect((await store.getAllItems()).map((i) => i.id)).toEqual(['mine']);
  });
});
