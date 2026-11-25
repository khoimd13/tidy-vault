import { describe, expect, it } from 'vitest';
import { fromBase64, pickRange } from '../../src/shared/videoStream';

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
