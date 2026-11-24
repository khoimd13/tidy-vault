// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  parseLabelDate,
  parsePhotoId,
  readVisibleItems,
  toSizedThumb,
} from '../../src/source/googlePhotosDom';

describe('parsePhotoId', () => {
  it('reads the id from relative and absolute links', () => {
    expect(parsePhotoId('./photo/AF1QipN_abc-123')).toBe('AF1QipN_abc-123');
    expect(parsePhotoId('https://photos.google.com/photo/XYZ?x=1')).toBe('XYZ');
  });
  it('returns null for other links', () => {
    expect(parsePhotoId('/albums')).toBeNull();
  });
});

describe('toSizedThumb', () => {
  it('replaces existing size options', () => {
    expect(toSizedThumb('https://lh3.googleusercontent.com/abc=w256-h171-no', 224)).toBe(
      'https://lh3.googleusercontent.com/abc=w224-h224',
    );
  });
  it('appends size options when there are none', () => {
    expect(toSizedThumb('https://lh3.googleusercontent.com/abc', 100)).toBe(
      'https://lh3.googleusercontent.com/abc=w100-h100',
    );
  });
  it('keeps empty input empty', () => {
    expect(toSizedThumb('')).toBe('');
  });
});

describe('parseLabelDate', () => {
  it('reads English month dates', () => {
    expect(parseLabelDate('Photo - Portrait - Mar 3, 2022, 10:15:23 AM')).toBe('2022-03-03');
    expect(parseLabelDate('Video - Landscape - Sept. 12, 2019')).toBe('2019-09-12');
  });
  it('returns null when no date is present', () => {
    expect(parseLabelDate('Ảnh - 3 thg 3, 2022')).toBeNull();
  });
});

describe('readVisibleItems', () => {
  it('reads tiles from background-image and img markup', () => {
    document.body.innerHTML = `
      <a href="./photo/AAA" aria-label="Photo - Portrait - Mar 3, 2022">
        <div style="background-image: url('https://lh3.googleusercontent.com/aaa=w256-h171-no')"></div>
      </a>
      <a href="./photo/BBB" aria-label="Video - Landscape - Jan 1, 2020">
        <img src="https://lh3.googleusercontent.com/bbb=w100" />
      </a>
      <a href="./albums">Albums</a>`;
    const items = readVisibleItems(document, 'https://photos.google.com');
    expect(items.map((i) => i.id)).toEqual(['AAA', 'BBB']);
    expect(items[0]).toMatchObject({
      url: 'https://photos.google.com/photo/AAA',
      thumbUrl: 'https://lh3.googleusercontent.com/aaa=w224-h224',
      takenAt: '2022-03-03',
      kind: 'photo',
    });
    expect(items[1]?.kind).toBe('video');
  });
});

describe('readVisibleItems safety', () => {
  it('builds plain photo links and drops non-Google image URLs', () => {
    document.body.innerHTML = `
      <a href="/album/X/photo/CCC" aria-label="Photo">
        <img src="https://evil.example.com/googleusercontent.png" />
      </a>`;
    const [item] = readVisibleItems(document, 'https://photos.google.com');
    expect(item?.url).toBe('https://photos.google.com/photo/CCC');
    expect(item?.thumbUrl).toBe('');
  });
});
