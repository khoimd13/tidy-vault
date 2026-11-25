/**
 * The ONLY module that knows how the Google Photos web page is built.
 * When Google changes its markup, fix it here and in tests/source/googlePhotosDom.test.ts.
 *
 * Checked against the live site (Nov 2026): each tile is `a[href="./photo/<id>"]` with an
 * aria-label like "Ảnh – Dọc – 19:38:50 24 thg 11, 2024" or "Photo - Portrait - Mar 3, 2022", and a
 * child div carrying the thumbnail in `style="background-image:url(…)"` and `data-latest-bg`.
 * Thumbnails come from photos.fife.usercontent.google.com (older: lh3.googleusercontent.com) as
 * `/pw/<id>=w90-h200-no?authuser=0` and only load with the signed-in Google session.
 */
import type { PhotoItem } from '../shared/types';

const PHOTO_LINK = 'a[href*="/photo/"]';
export const THUMB_SIZE = 224;

export function parsePhotoId(href: string): string | null {
  const m = /\/photo\/([A-Za-z0-9_-]+)/.exec(href);
  return m?.[1] ?? null;
}

/** Google's photo image servers. */
const THUMB_HOST = /(^|\.)(googleusercontent\.com|usercontent\.google\.com)$/;

export function isGoogleImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && THUMB_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Image URLs carry size options after the last "=" in the path (`/pw/<id>=w90-h200-no`), sometimes
 * followed by a query such as `?authuser=0`, which must be kept.
 */
export function toSizedThumb(src: string, size = THUMB_SIZE): string {
  if (!src) return '';
  try {
    const url = new URL(src);
    url.pathname = `${url.pathname.replace(/=[^/=]*$/, '')}=w${size}-h${size}`;
    return url.toString();
  } catch {
    return '';
  }
}

const EN_DATE = /([A-Z][a-z]{2,8})\.? (\d{1,2}), (\d{4})/;
/** Vietnamese: "24 thg 11, 2024" (day, "thg" = month, month number, year). */
const VI_DATE = /(\d{1,2}) thg (\d{1,2}),? (\d{4})/;

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Reads the date from a tile label (English or Vietnamese). Returns yyyy-mm-dd or null. */
export function parseLabelDate(label: string): string | null {
  const vi = VI_DATE.exec(label);
  if (vi) return isoDate(Number(vi[3]), Number(vi[2]), Number(vi[1]));
  const en = EN_DATE.exec(label);
  if (!en) return null;
  const t = Date.parse(`${en[1]} ${en[2]}, ${en[3]} 12:00 UTC`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|SA|CH)?/i;

/**
 * Date and time from a tile label, in ms (wall-clock read as UTC; only differences matter).
 * "Ảnh – Dọc – 19:38:50 24 thg 11, 2024" or "Photo - Mar 3, 2022, 10:15:23 AM".
 */
export function parseLabelTimestamp(label: string): number | null {
  const date = parseLabelDate(label);
  const t = TIME.exec(label);
  if (!date || !t) return null;
  let hours = Number(t[1]);
  const mer = t[4]?.toUpperCase();
  if ((mer === 'PM' || mer === 'CH') && hours < 12) hours += 12;
  if ((mer === 'AM' || mer === 'SA') && hours === 12) hours = 0;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, hours, Number(t[2]), Number(t[3] ?? 0));
}

/** A thumbnail URL carried by this one element, if any. */
function thumbOf(el: Element): string {
  const latest = el.getAttribute('data-latest-bg');
  if (latest && isGoogleImageUrl(latest)) return latest;
  const src = el.getAttribute('src');
  if (el.tagName === 'IMG' && src && isGoogleImageUrl(src)) return src;
  if (el instanceof HTMLElement) {
    const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage);
    if (m?.[1] && isGoogleImageUrl(m[1])) return m[1];
  }
  return '';
}

function thumbInSubtree(root: Element): string {
  const candidates = root.querySelectorAll('[data-latest-bg], img, [style*="background"]');
  for (const el of [root, ...Array.from(candidates)]) {
    const url = thumbOf(el);
    if (url) return url;
  }
  return '';
}

/**
 * Search the link (where Google puts the thumbnail today), then each wrapper above it, stopping
 * before a wrapper that also holds another photo, so a neighbour's thumbnail is never picked up.
 */
function findThumb(tile: Element): string {
  let scope: Element | null = tile;
  for (let depth = 0; scope && depth < 6; depth++) {
    const url = thumbInSubtree(scope);
    if (url) return url;
    const parent: Element | null = scope.parentElement;
    if (!parent || parent.querySelectorAll(PHOTO_LINK).length > 1) break;
    scope = parent;
  }
  return thumbUnder(tile);
}

/** Background image from CSS (classes or inline), as the browser computed it. */
function computedThumb(el: Element): string {
  const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(el).backgroundImage);
  return m?.[1] && isGoogleImageUrl(m[1]) ? m[1] : '';
}

/**
 * Layout-independent fallback: ask the browser what is drawn at the centre of the tile. Only
 * possible for tiles currently on screen; the scanner re-reads tiles until they have a thumbnail.
 */
function thumbUnder(tile: Element): string {
  const doc = tile.ownerDocument;
  if (typeof doc.elementsFromPoint !== 'function') return '';
  const r = tile.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return '';
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const view = doc.defaultView;
  if (!view || x < 0 || y < 0 || x > view.innerWidth || y > view.innerHeight) return '';
  for (const el of doc.elementsFromPoint(x, y)) {
    const url = thumbOf(el) || computedThumb(el);
    if (url) return url;
  }
  return '';
}

const DURATION = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/;

/** "0:03" → 3, "1:02:05" → 3725; null when it isn't a duration. */
export function parseDuration(text: string): number | null {
  const m = DURATION.exec(text.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * The duration badge Google draws on video tiles (e.g. "0:03"), searched like the thumbnail:
 * in the link first, then in wrappers that hold no other photo.
 */
function findDuration(tile: Element): number | null {
  let scope: Element | null = tile;
  for (let depth = 0; scope && depth < 4; depth++) {
    for (const el of Array.from(scope.querySelectorAll('*'))) {
      if (el.childElementCount > 0) continue;
      const seconds = parseDuration(el.textContent ?? '');
      if (seconds !== null) return seconds;
    }
    const parent: Element | null = scope.parentElement;
    if (!parent || parent.querySelectorAll(PHOTO_LINK).length > 1) break;
    scope = parent;
  }
  return null;
}

function videoInfo(label: string, durationSec: number | null) {
  const video = /^vid(e|é)o\b/i.test(label.trim()) || durationSec !== null;
  return video ? { kind: 'video' as const, durationSec } : { kind: 'photo' as const };
}

export function readTile(tile: HTMLAnchorElement, origin: string): PhotoItem | null {
  const href = tile.getAttribute('href') ?? '';
  const id = parsePhotoId(href);
  if (!id) return null;
  const label = tile.getAttribute('aria-label') ?? '';
  const rect = tile.getBoundingClientRect();
  return {
    id,
    // Rebuilt from the id (not the raw href) so the panel only ever links to a plain photo page.
    url: `${origin}/photo/${id}`,
    thumbUrl: toSizedThumb(findThumb(tile)),
    takenAt: parseLabelDate(label),
    takenTs: parseLabelTimestamp(label),
    aspect: rect.width > 0 && rect.height > 0 ? rect.width / rect.height : null,
    // Videos: the label starts with "Video" (English and Vietnamese) or the tile shows a duration.
    ...videoInfo(label, findDuration(tile)),
    label,
  };
}

/** All photo tiles currently rendered in the page. */
export function readVisibleItems(
  root: ParentNode = document,
  origin = location.origin,
): PhotoItem[] {
  const items: PhotoItem[] = [];
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>(PHOTO_LINK))) {
    const item = readTile(a, origin);
    if (item) items.push(item);
  }
  return items;
}

/**
 * The element that scrolls the photo grid. Google Photos uses an inner scroller (a `c-wiz`), and
 * the first photo link on the page can sit outside it, so pick the scrollable element that holds
 * photo tiles and has the most to scroll.
 */
export function findScrollContainer(doc: Document = document): Element {
  let best: Element | null = null;
  let bestHeight = 0;
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    if (el.scrollHeight <= el.clientHeight + 50 || el.scrollHeight <= bestHeight) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
    if (!el.querySelector(PHOTO_LINK)) continue;
    best = el;
    bestHeight = el.scrollHeight;
  }
  return best ?? doc.scrollingElement ?? doc.documentElement;
}

/**
 * Downloads thumbnails from the page, where the Google session applies (they return 403
 * without it). Returns data: URLs so they can cross to the side panel; null for failures.
 */
export async function fetchThumbnails(urls: readonly string[]): Promise<(string | null)[]> {
  return Promise.all(
    urls.map(async (url) => {
      if (!isGoogleImageUrl(url)) return null;
      try {
        const res = await fetch(url, {
          credentials: 'include',
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }),
  );
}

/**
 * Video playback links Google offers, tried in order: 360p, 720p, 1080p. Not every video has
 * every one, and Google's video servers sometimes refuse one but serve another.
 */
const VIDEO_VARIANTS = ['m18', 'm22', 'm37'] as const;

/** A video playback link built from its thumbnail link (`…=w224-h224` → `…=m18`). */
export function toVideoUrl(thumbUrl: string, variant: string = VIDEO_VARIANTS[0]): string {
  if (!isGoogleImageUrl(thumbUrl)) return '';
  const url = new URL(thumbUrl);
  url.pathname = `${url.pathname.replace(/=[^/=]*$/, '')}=${variant}`;
  return url.toString();
}

export type VideoDownload =
  { ok: true; blob: Blob } | { ok: false; reason: 'unavailable' | 'too-big' };

export interface VideoDownloadOptions {
  fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  /** Stop (and say so) once a video turns out bigger than this. */
  maxBytes?: number;
  onProgress?: (loaded: number, total: number | null) => void;
  /** Give up on a link when Google sends nothing for this long (its servers sometimes hang). */
  stallMs?: number;
}

/**
 * Downloads a video from the page, where the Google session applies. Google's video links only
 * answer requests from photos.google.com, so the side panel can't stream them itself.
 */
export async function downloadVideo(
  thumbUrl: string,
  {
    fetcher = (u, i) => fetch(u, i),
    maxBytes = 25_000_000,
    onProgress,
    stallMs = 20_000,
  }: VideoDownloadOptions = {},
): Promise<VideoDownload> {
  for (const variant of VIDEO_VARIANTS) {
    const url = toVideoUrl(thumbUrl, variant);
    if (!url) break;
    const abort = new AbortController();
    let stall = setTimeout(() => abort.abort(), stallMs);
    const alive = () => {
      clearTimeout(stall);
      stall = setTimeout(() => abort.abort(), stallMs);
    };
    try {
      const res = await fetcher(url, { credentials: 'include', signal: abort.signal });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('video/') || !res.body) {
        abort.abort();
        continue;
      }
      const length = Number(res.headers.get('content-length'));
      const total = Number.isFinite(length) && length > 0 ? length : null;
      if (total !== null && total > maxBytes) {
        abort.abort();
        return { ok: false, reason: 'too-big' };
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        alive();
        chunks.push(value);
        loaded += value.byteLength;
        if (loaded > maxBytes) {
          abort.abort();
          return { ok: false, reason: 'too-big' };
        }
        onProgress?.(loaded, total);
      }
      if (loaded === 0) continue;
      return { ok: true, blob: new Blob(chunks, { type }) };
    } catch {
      abort.abort();
      // Try the next variant.
    } finally {
      clearTimeout(stall);
    }
  }
  return { ok: false, reason: 'unavailable' };
}
