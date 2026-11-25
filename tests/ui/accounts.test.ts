import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCAN_PROGRESS_KEY, scanProgressKey } from '../../src/shared/messages';
import { currentDatabase, DEFAULT_DB_NAME } from '../../src/store/db';
import { lastAccount, openAccount } from '../../src/ui/lib/accounts';

const data = new Map<string, unknown>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: (key: string) => Promise.resolve(data.has(key) ? { [key]: data.get(key) } : {}),
      set: (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) data.set(k, v);
        return Promise.resolve();
      },
      remove: (key: string) => {
        data.delete(key);
        return Promise.resolve();
      },
    },
  },
};

describe('accounts', () => {
  beforeEach(() => data.clear());

  it('gives the first account the results saved before accounts were kept apart', async () => {
    data.set(SCAN_PROGRESS_KEY, { top: 500 });
    await openAccount({ id: '1', email: 'a@example.com' });
    expect(currentDatabase()).toBe(DEFAULT_DB_NAME);
    expect(data.get(scanProgressKey('1'))).toEqual({ top: 500 });
    expect(data.has(SCAN_PROGRESS_KEY)).toBe(false);
  });

  it('gives other accounts their own database and remembers the last one', async () => {
    await openAccount({ id: '1', email: 'a@example.com' });
    await openAccount({ id: '2', email: 'b@example.com' });
    expect(currentDatabase()).toBe(`${DEFAULT_DB_NAME}:2`);
    expect(await lastAccount()).toEqual({ id: '2', email: 'b@example.com' });
    await openAccount({ id: '1', email: null });
    expect(currentDatabase()).toBe(DEFAULT_DB_NAME);
    // The email seen before is kept when the page doesn't say it.
    expect(await lastAccount()).toEqual({ id: '1', email: 'a@example.com' });
  });
});
