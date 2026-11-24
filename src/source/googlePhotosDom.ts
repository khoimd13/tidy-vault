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

function findThumb(tile: Element): string {
  const img = tile.querySelector<HTMLImageElement>('img[src*="googleusercontent"]');
  if (img?.getAttribute('src')) return img.getAttribute('src') ?? '';
  const nodes = [tile, ...Array.from(tile.querySelectorAll('[style*="background-image"]'))];
  for (const node of nodes) {
    const bg = node instanceof HTMLElement ? node.style.backgroundImage : '';
    const m = /url\(["']?(.*?)["']?\)/.exec(bg);
    if (m?.[1]) return m[1];
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
