// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  parseLabelDate,
  parseDuration,
  parseLabelTimestamp,
  parsePhotoId,
  readVisibleItems,
  downloadVideo,
  fetchVideoRange,
  findVideoStream,
  isGoogleVideoUrl,
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
  const stream = (itag: string) => `https://rr3---sn-x.googlevideo.com/videoplayback?itag=${itag}`;

  /** A fake Google: per variant, how it answers (ms delay, or 'fail'). */
  function fakeGoogle(answers: Record<string, number | 'fail'>, total = 5_000_000) {
    const asked: { url: string; init: RequestInit }[] = [];
    const fetcher = (url: string, init: RequestInit): Promise<Response> => {
      asked.push({ url, init });
      const respond = (
        body: BodyInit | null,
        status: number,
        headers: Record<string, string>,
        final: string,
      ) => {
        const res = new Response(body, { status, headers });
        Object.defineProperty(res, 'url', { value: final });
        return res;
      };
      if (url.includes('googlevideo.com')) {
        if (init.method === 'HEAD') {
          return Promise.resolve(
            respond(
              null,
              200,
              { 'content-type': 'video/mp4', 'content-length': String(total) },
              url,
            ),
          );
        }
        const m = /bytes=(\d+)-(\d+)/.exec(String((init.headers as Record<string, string>).Range));
        const size = Number(m?.[2]) - Number(m?.[1]) + 1;
        return Promise.resolve(
          respond(new Uint8Array(size), 206, { 'content-type': 'video/mp4' }, url),
        );
      }
      const variant = /=(m\d+)/.exec(url)?.[1] ?? '';
      const how = answers[variant] ?? 'fail';
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        setTimeout(
          () =>
            how === 'fail'
              ? resolve(respond('', 500, { 'content-type': 'text/plain' }, url))
              : resolve(respond('ab', 206, { 'content-type': 'video/mp4' }, stream(variant))),
          how === 'fail' ? 5 : how,
        );
      });
    };
    return { asked, fetcher };
  }

  it('builds playback links and keeps the query', () => {
    expect(toVideoUrl(thumb)).toBe(
      'https://photos.fife.usercontent.google.com/pw/AP1GczAbc=m18?authuser=0',
    );
    expect(toVideoUrl(thumb, 'm37')).toContain('=m37?authuser=0');
    expect(toVideoUrl('https://evil.example/x=w1-h1')).toBe('');
  });

  it('asks every quality at once and keeps the first that answers', async () => {
    // 360p fails, 720p is slow, 1080p (the stored file) answers fast.
    const { asked, fetcher } = fakeGoogle({ m22: 200, m37: 10 });
    const found = await findVideoStream(thumb, { fetcher });
    expect(found).toEqual({ url: stream('m37'), total: 5_000_000, type: 'video/mp4' });
    // All three asked together with the page session, two bytes each.
    const probes = asked.filter((a) => !a.url.includes('googlevideo'));
    expect(probes).toHaveLength(3);
    expect(probes.every((p) => p.init.credentials === 'include')).toBe(true);
  });

  it('finds nothing when no quality answers in time', async () => {
    const { fetcher } = fakeGoogle({ m18: 500 });
    expect(await findVideoStream(thumb, { fetcher, timeoutMs: 30 })).toBeNull();
    expect(await findVideoStream('', { fetcher })).toBeNull();
  });

  it('reads byte ranges only from Google video servers', async () => {
    const { fetcher } = fakeGoogle({});
    expect((await fetchVideoRange(stream('m37'), 100, 199, fetcher))?.byteLength).toBe(100);
    expect(await fetchVideoRange('https://evil.example/v', 0, 9, fetcher)).toBeNull();
    expect(await fetchVideoRange(stream('m37'), 10, 5, fetcher)).toBeNull();
    expect(isGoogleVideoUrl('http://rr1.googlevideo.com/x')).toBe(false);
  });

  it('downloads short videos whole, in pieces, with progress', async () => {
    const { fetcher } = fakeGoogle({ m18: 5 }, 4_500_000);
    const progress: number[] = [];
    const result = await downloadVideo(thumb, {
      fetcher,
      onProgress: (loaded, total) => progress.push(total ? loaded / total : 0),
    });
    expect(result.ok && result.blob.size).toBe(4_500_000);
    expect(progress.at(-1)).toBe(1);
    expect(progress.length).toBe(3);
  });

  it('refuses to download big videos whole', async () => {
    const { fetcher } = fakeGoogle({ m37: 5 }, 400_000_000);
    expect(await downloadVideo(thumb, { fetcher })).toEqual({ ok: false, reason: 'too-big' });
    expect(await downloadVideo(thumb, { fetcher: fakeGoogle({}).fetcher })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
