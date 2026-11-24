/**
 * The ONLY module that knows how the Google Photos web page is built.
 * When Google changes its markup, fix it here and in tests/source/googlePhotosDom.test.ts.
 *
 * Selectors below are best-effort and must be re-checked against the live site.
 */
import type { PhotoItem } from '../shared/types';

const PHOTO_LINK = 'a[href*="/photo/"]';
export const THUMB_SIZE = 224;

export function parsePhotoId(href: string): string | null {
  const m = /\/photo\/([A-Za-z0-9_-]+)/.exec(href);
  return m?.[1] ?? null;
}

/** googleusercontent URLs carry size options after a trailing "=", e.g. `...=w256-h171-no`. */
export function toSizedThumb(src: string, size = THUMB_SIZE): string {
  if (!src) return '';
  return `${src.replace(/=[^/=]*$/, '')}=w${size}-h${size}`;
}

const MONTH_DATE = /([A-Z][a-z]{2,8})\.? (\d{1,2}), (\d{4})/;

/** Reads an English date like "Mar 3, 2022" from a tile label. Returns yyyy-mm-dd or null. */
export function parseLabelDate(label: string): string | null {
  const m = MONTH_DATE.exec(label);
  if (!m) return null;
  const t = Date.parse(`${m[1]} ${m[2]}, ${m[3]} 12:00 UTC`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

const THUMB_HOST = 'googleusercontent.com';

/** A thumbnail URL carried by this one element, if any. */
function thumbOf(el: Element): string {
  const latest = el.getAttribute('data-latest-bg');
  if (latest?.includes(THUMB_HOST)) return latest;
  const src = el.getAttribute('src');
  if (el.tagName === 'IMG' && src?.includes(THUMB_HOST)) return src;
  if (el instanceof HTMLElement) {
    const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage);
    if (m?.[1]?.includes(THUMB_HOST)) return m[1];
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
 * The thumbnail is usually not inside the photo link but next to it, in the same tile wrapper.
 * Search the link, then each wrapper above it, stopping before a wrapper that also holds another
 * photo (so a neighbour's thumbnail is never picked up).
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
  return m?.[1]?.includes(THUMB_HOST) ? m[1] : '';
}

/**
 * Layout-independent fallback: ask the browser what is drawn at the centre of the tile. Works
 * when the link is a transparent layer above an image that lives elsewhere in the page. Only
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

/** Only https images from Google's image servers are passed on to the panel. */
function safeImageUrl(src: string): string {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname.endsWith('.googleusercontent.com') ? src : '';
  } catch {
    return '';
  }
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
    thumbUrl: toSizedThumb(safeImageUrl(findThumb(tile))),
    takenAt: parseLabelDate(label),
    aspect: rect.width > 0 && rect.height > 0 ? rect.width / rect.height : null,
    kind: /^video\b/i.test(label) ? 'video' : 'photo',
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

/** The element that scrolls the photo grid (Google Photos uses an inner scroller). */
export function findScrollContainer(doc: Document = document): Element {
  let el = doc.querySelector(PHOTO_LINK)?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (/(auto|scroll)/.test(overflowY) && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return doc.scrollingElement ?? doc.documentElement;
}
