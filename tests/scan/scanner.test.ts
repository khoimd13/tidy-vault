import { describe, expect, it } from 'vitest';
import { Scanner, type ScanDeps } from '../../src/scan/scanner';
import type { PhotoItem } from '../../src/shared/types';
import { photo } from '../fixtures';

/** A fake page: each scroll step reveals the next "screen" of items. */
function fakePage(screens: string[][]) {
  let pos = 0;
  const received: PhotoItem[] = [];
  const deps: ScanDeps = {
    readItems: () => (screens[Math.min(pos, screens.length - 1)] ?? []).map((id) => photo(id)),
    scrollStep: () => {
      pos += 1;
    },
    atEnd: () => pos >= screens.length - 1,
    sleep: () => Promise.resolve(),
    onItems: (items) => received.push(...items),
    onProgress: () => undefined,
  };
  return { deps, received };
}

const opts = {
  stepDelayMs: 0,
  jitterMs: 0,
  maxIdleSteps: 2,
  maxIdleBeforeEnd: 10,
  backoffMs: 0,
  maxBackoffMs: 0,
  knownStopSteps: 2,
  random: () => 0,
};

describe('Scanner', () => {
  it('reports every item exactly once and ends when nothing new appears', async () => {
    const { deps, received } = fakePage([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ]);
    const scanner = new Scanner(deps, opts);
    await expect(scanner.run()).resolves.toBe('end');
    expect(received.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(scanner.status).toBe('done');
  });

  it('can be paused, resumed and cancelled', async () => {
    // An endless page: every step shows one new photo, so only cancel can stop it.
    let pos = 0;
    let steps = 0;
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    const scanner = new Scanner(
      {
        readItems: () => [photo(`p${pos}`)],
        scrollStep: () => {
          pos += 1;
        },
        sleep: async () => {
          steps += 1;
          if (steps === 1) scanner.pause();
          await tick();
        },
        atEnd: () => false,
        onItems: () => undefined,
        onProgress: () => undefined,
      },
      opts,
    );
    const done = scanner.run();
    await tick();
    await tick();
    expect(scanner.status).toBe('paused');
    const pausedAt = scanner.seenCount;
    await tick();
    expect(scanner.seenCount).toBe(pausedAt);

    scanner.resume();
    for (let i = 0; i < 5; i++) await tick();
    expect(scanner.seenCount).toBeGreaterThan(pausedAt);

    scanner.cancel();
    await expect(done).resolves.toBe('cancelled');
  });

  it('reports a photo again once its thumbnail has loaded', async () => {
    const screens = [
      [photo('a', { thumbUrl: '' })],
      [photo('a', { thumbUrl: 'https://lh3.googleusercontent.com/a' }), photo('b')],
      [photo('b')],
    ];
    let pos = 0;
    const received: PhotoItem[] = [];
    const scanner = new Scanner(
      {
        readItems: () => screens[Math.min(pos, screens.length - 1)] ?? [],
        scrollStep: () => {
          pos += 1;
        },
        sleep: () => Promise.resolve(),
        atEnd: () => pos >= screens.length - 1,
        onItems: (items) => received.push(...items),
        onProgress: () => undefined,
      },
      opts,
    );
    await scanner.run();
    expect(received.map((i) => [i.id, i.thumbUrl !== ''])).toEqual([
      ['a', false],
      ['a', true],
      ['b', true],
    ]);
    expect(scanner.seenCount).toBe(2);
  });

  it('keeps going through slow loading that is not the end of the page', async () => {
    // Three empty steps mid-page (Google still loading) used to end the scan early.
    const { deps, received } = fakePage([['a'], [], [], [], ['b'], ['c']]);
    await expect(new Scanner(deps, opts).run()).resolves.toBe('end');
    expect(received.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('gives up if nothing new appears for very long, even before the end', async () => {
    const { deps } = fakePage([['a'], ...Array.from({ length: 30 }, () => [] as string[]), ['z']]);
    await expect(new Scanner(deps, { ...opts, maxIdleBeforeEnd: 5 }).run()).resolves.toBe('end');
  });

  it('stops "check for new photos" once only known photos are on screen', async () => {
    const { deps, received } = fakePage([['n1', 'n2'], ['n2', 'k1'], ['k1', 'k2'], ['k3'], ['k4']]);
    const scanner = new Scanner(deps, { ...opts, known: new Set(['k1', 'k2', 'k3', 'k4']) });
    await expect(scanner.run()).resolves.toBe('caught-up');
    // Two steps in a row with only known photos (n2 was already reported) → caught up.
    expect(received.map((i) => i.id)).toEqual(['n1', 'n2', 'k1', 'k2']);
  });

  it('refuses to run twice at the same time', async () => {
    const { deps } = fakePage([['a']]);
    const scanner = new Scanner(deps, { ...opts, maxIdleSteps: 100 });
    const first = scanner.run();
    await expect(scanner.run()).rejects.toThrow('already in progress');
    scanner.cancel();
    await first;
  });
});
