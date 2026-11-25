import { describe, expect, it } from 'vitest';
import { fromBase64, pickRange, pieceStream } from '../../src/shared/videoStream';

describe('pickRange', () => {
  const total = 10_000_000;

  it('answers open-ended ranges one chunk at a time', () => {
    expect(pickRange('bytes=0-', total, 1000)).toEqual({ start: 0, end: 999 });
    expect(pickRange('bytes=5000-', total, 1000)).toEqual({ start: 5000, end: 5999 });
    expect(pickRange(null, total, 1000)).toEqual({ start: 0, end: 999 });
  });

  it('keeps a smaller range as asked and stops at the end of the file', () => {
    expect(pickRange('bytes=10-19', total, 1000)).toEqual({ start: 10, end: 19 });
    expect(pickRange(`bytes=${total - 5}-`, total, 1000)).toEqual({
      start: total - 5,
      end: total - 1,
    });
    expect(pickRange('bytes=-100', total, 1000)).toEqual({ start: total - 100, end: total - 1 });
  });

  it('can answer the whole range asked for (the stream reads it piece by piece)', () => {
    expect(pickRange('bytes=0-', total, Infinity)).toEqual({ start: 0, end: total - 1 });
    expect(pickRange('bytes=4000-4999', total, Infinity)).toEqual({ start: 4000, end: 4999 });
  });

  it('rejects ranges that cannot be served', () => {
    expect(pickRange(`bytes=${total}-`, total)).toBeNull();
    expect(pickRange('bytes=20-10', total)).toBeNull();
    expect(pickRange('items=0-5', total)).toBeNull();
  });
});

describe('fromBase64', () => {
  it('turns base64 back into bytes', () => {
    expect([...fromBase64(btoa('\x00\x01\xff'))]).toEqual([0, 1, 255]);
  });
});

describe('pieceStream', () => {
  const source = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);

  async function readAll(stream: ReadableStream<Uint8Array>): Promise<number[]> {
    const out: number[] = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return out;
      out.push(...value);
    }
  }

  it('delivers the whole range in order, one piece at a time', async () => {
    const asked: [number, number][] = [];
    const stream = pieceStream(
      100,
      549,
      (from, to) => {
        asked.push([from, to]);
        return Promise.resolve(source.slice(from, to + 1));
      },
      200,
    );
    expect(await readAll(stream)).toEqual([...source.slice(100, 550)]);
    expect(asked).toEqual([
      [100, 299],
      [300, 499],
      [500, 549],
    ]);
  });

  it('reads only a piece ahead of the reader', async () => {
    let reads = 0;
    const stream = pieceStream(
      0,
      999,
      (from, to) => {
        reads += 1;
        return Promise.resolve(source.slice(from, to + 1));
      },
      100,
    );
    const reader = stream.getReader();
    await reader.read();
    await new Promise((r) => setTimeout(r, 10));
    expect(reads).toBeLessThanOrEqual(2);
    await reader.cancel();
  });

  it('fails the stream when a piece cannot be read', async () => {
    const stream = pieceStream(
      0,
      999,
      (from) => Promise.resolve(from === 0 ? source.slice(0, 100) : null),
      100,
    );
    await expect(readAll(stream)).rejects.toThrow('stopped sending');
  });
});
