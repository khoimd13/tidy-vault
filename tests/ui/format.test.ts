import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../src/ui/lib/format';

describe('formatDuration', () => {
  it('formats seconds like a video player', () => {
    expect(formatDuration(3)).toBe('0:03');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
