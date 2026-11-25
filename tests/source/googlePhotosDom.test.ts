// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  parseLabelDate,
  parseDuration,
  parseLabelTimestamp,
  parsePhotoId,
  readVisibleItems,
  downloadVideo,
  toSizedThumb,
  toVideoUrl,
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
    expect(parseLabelDate('Ảnh – Dọc')).toBeNull();
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

describe('thumbnail lookup in real-world tile layouts', () => {
  it('finds a thumbnail that sits next to the link in the tile wrapper', () => {
    document.body.innerHTML = `
      <div class="row">
        <div class="tile">
          <div style="background-image: url('https://lh3.googleusercontent.com/one=w200')"></div>
          <a href="./photo/ONE" aria-label="Photo - Mar 3, 2022"></a>
        </div>
        <div class="tile">
          <div data-latest-bg="https://lh3.googleusercontent.com/two=w200"></div>
          <a href="./photo/TWO" aria-label="Photo - Mar 4, 2022"></a>
        </div>
        <div class="tile">
          <a href="./photo/THREE" aria-label="Photo - Mar 5, 2022"></a>
        </div>
      </div>`;
    const items = readVisibleItems(document, 'https://photos.google.com');
    expect(items.map((i) => [i.id, i.thumbUrl])).toEqual([
      ['ONE', 'https://lh3.googleusercontent.com/one=w224-h224'],
      ['TWO', 'https://lh3.googleusercontent.com/two=w224-h224'],
      // No thumbnail of its own: it must not borrow a neighbour's.
      ['THREE', ''],
    ]);
  });
});

describe('live-site formats (Nov 2026)', () => {
  it('accepts the new image host and keeps the authuser query when resizing', () => {
    expect(
      toSizedThumb('https://photos.fife.usercontent.google.com/pw/ABC=w90-h200-no?authuser=0'),
    ).toBe('https://photos.fife.usercontent.google.com/pw/ABC=w224-h224?authuser=0');
  });

  it('reads Vietnamese labels', () => {
    expect(parseLabelDate('Ảnh – Dọc – 19:38:50 24 thg 11, 2024')).toBe('2024-11-24');
    expect(parseLabelDate('Ảnh – Ngang – 3 thg 1, 2021')).toBe('2021-01-03');
  });

  it('reads a real tile: thumbnail in a child div of the link', () => {
    document.body.innerHTML = `
      <div class="rtIMgb">
        <a class="p137Zd" href="./photo/AF1Qip" aria-label="Ảnh – Dọc – 19:38:50 24 thg 11, 2024">
          <div class="RY3tic"
            style="background-image: url(&quot;https://photos.fife.usercontent.google.com/pw/X=w90-h200-no?authuser=0&quot;);"
            data-latest-bg="https://photos.fife.usercontent.google.com/pw/X=w90-h200-no?authuser=0"></div>
        </a>
      </div>`;
    const [item] = readVisibleItems(document, 'https://photos.google.com');
    expect(item).toMatchObject({
      id: 'AF1Qip',
      thumbUrl: 'https://photos.fife.usercontent.google.com/pw/X=w224-h224?authuser=0',
      takenAt: '2024-11-24',
      kind: 'photo',
    });
  });
});

describe('parseLabelTimestamp', () => {
  it('reads time and date from Vietnamese and English labels', () => {
    expect(parseLabelTimestamp('Ảnh – Dọc – 19:38:50 24 thg 11, 2024')).toBe(
      Date.UTC(2024, 10, 24, 19, 38, 50),
    );
    expect(parseLabelTimestamp('Photo - Portrait - Mar 3, 2022, 10:15:23 PM')).toBe(
      Date.UTC(2022, 2, 3, 22, 15, 23),
    );
    expect(parseLabelTimestamp('Photo - Mar 3, 2022, 12:05:00 AM')).toBe(
      Date.UTC(2022, 2, 3, 0, 5, 0),
    );
  });
  it('returns null without a time', () => {
    expect(parseLabelTimestamp('Ảnh – 24 thg 11, 2024')).toBeNull();
  });
});

describe('videos', () => {
  it('parses durations', () => {
    expect(parseDuration('0:03')).toBe(3);
    expect(parseDuration(' 12:40 ')).toBe(760);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('19:38:50 24 thg 11')).toBeNull();
  });

  it('reads a video tile with its duration badge', () => {
    document.body.innerHTML = `
      <div class="tile">
        <a href="./photo/VID1" aria-label="Video – Dọc – 10:00:00 2 thg 3, 2023">
          <div data-latest-bg="https://photos.fife.usercontent.google.com/pw/V=w90-h200-no?authuser=0"></div>
          <div class="badge"><span>0:03</span></div>
        </a>
      </div>
      <div class="tile">
        <a href="./photo/PIC1" aria-label="Ảnh – Dọc – 10:00:05 2 thg 3, 2023"></a>
      </div>`;
    const [video, picture] = readVisibleItems(document, 'https://photos.google.com');
    expect(video).toMatchObject({ id: 'VID1', kind: 'video', durationSec: 3 });
    expect(picture).toMatchObject({ id: 'PIC1', kind: 'photo' });
    expect(picture && 'durationSec' in picture).toBe(false);
  });
});

describe('video playback', () => {
  const thumb = 'https://photos.fife.usercontent.google.com/pw/AP1GczAbc=w224-h224?authuser=0';

  it('builds playback links and keeps the query', () => {
    expect(toVideoUrl(thumb)).toBe(
      'https://photos.fife.usercontent.google.com/pw/AP1GczAbc=m18?authuser=0',
    );
    expect(toVideoUrl(thumb, 'm22')).toContain('=m22?authuser=0');
    expect(toVideoUrl('https://evil.example/x=w1-h1')).toBe('');
  });

  const video = (bytes: number, type = 'video/mp4', status = 200, length = true) =>
    Promise.resolve(
      new Response(new Uint8Array(bytes), {
        status,
        headers: { 'content-type': type, ...(length ? { 'content-length': String(bytes) } : {}) },
      }),
    );

  it('downloads the video with the page session and reports progress', async () => {
    const asked: { url: string; init: RequestInit }[] = [];
    const progress: (number | null)[] = [];
    const result = await downloadVideo(thumb, {
      fetcher: (url, init) => {
        asked.push({ url, init });
        return video(1000);
      },
      onProgress: (loaded, total) => progress.push(total && loaded / total),
    });
    expect(result.ok && result.blob.size).toBe(1000);
    expect(result.ok && result.blob.type).toBe('video/mp4');
    expect(asked[0]?.url).toContain('=m18');
    expect(asked[0]?.init.credentials).toBe('include');
    expect(progress.at(-1)).toBe(1);
  });

  it('falls back to another quality when Google refuses one', async () => {
    const asked: string[] = [];
    const result = await downloadVideo(thumb, {
      fetcher: (url) => {
        asked.push(url);
        if (url.includes('=m18')) return video(0, 'text/plain', 500);
        if (url.includes('=m22')) return Promise.reject(new Error('timeout'));
        return video(10);
      },
    });
    expect(result.ok).toBe(true);
    expect(asked.map((u) => /=(m\d+)/.exec(u)?.[1])).toEqual(['m18', 'm22', 'm37']);
  });

  it('gives up on a link that hangs and tries the next one', async () => {
    const asked: string[] = [];
    const result = await downloadVideo(thumb, {
      stallMs: 20,
      fetcher: (url, init) => {
        asked.push(url);
        if (!url.includes('=m18')) return video(10);
        // Never answers until aborted.
        return new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
    });
    expect(result.ok).toBe(true);
    expect(asked).toHaveLength(2);
  });

  it('stops on videos that are too big, with or without a stated size', async () => {
    expect(await downloadVideo(thumb, { fetcher: () => video(500), maxBytes: 100 })).toEqual({
      ok: false,
      reason: 'too-big',
    });
    const unsized = await downloadVideo(thumb, {
      fetcher: () => video(500, 'video/mp4', 200, false),
      maxBytes: 100,
    });
    expect(unsized).toEqual({ ok: false, reason: 'too-big' });
  });

  it('says unavailable when nothing is a video', async () => {
    expect(await downloadVideo(thumb, { fetcher: () => video(10, 'text/html') })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(await downloadVideo('', { fetcher: () => video(10) })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
