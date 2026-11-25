/** Thin wrappers around extension APIs used by the UI, so screens stay simple. */
import type { PanelResponse, PanelToContent } from '../../shared/messages';
import { STREAM_KEY, STREAM_PATH, type StreamInfo } from '../../shared/videoStream';

export const PHOTOS_ORIGIN = 'https://photos.google.com/';

/** The active tab, if it is Google Photos. Tab URLs are only visible for our host permission. */
export async function findPhotosTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined && tab.url?.startsWith(PHOTOS_ORIGIN) ? tab.id : null;
}

export async function sendToTab(tabId: number, msg: PanelToContent): Promise<PanelResponse> {
  return chrome.tabs.sendMessage<PanelToContent, PanelResponse>(tabId, msg);
}

export async function openGooglePhotos(): Promise<void> {
  await chrome.tabs.create({ url: PHOTOS_ORIGIN });
}

export async function getFlag(key: string): Promise<boolean> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(key);
  return stored[key] === true;
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Downloads thumbnails through the Google Photos tab (they need the Google session, which the
 * page has). Returns a Blob per URL, or null for ones that failed. Throws if the tab is gone.
 */
export async function fetchThumbsViaTab(tabId: number, urls: string[]): Promise<(Blob | null)[]> {
  const res = await sendToTab(tabId, { type: 'thumbs/fetch', urls });
  const thumbs = res.thumbs ?? [];
  return Promise.all(
    urls.map(async (_, i) => {
      const dataUrl = thumbs[i];
      if (!dataUrl?.startsWith('data:image/')) return null;
      try {
        return await (await fetch(dataUrl)).blob();
      } catch {
        return null;
      }
    }),
  );
}

export type VideoResult =
  { ok: true; blob: Blob } | { ok: false; reason: 'unavailable' | 'too-big' | 'no-tab' };

/** Downloads a video through the Google Photos tab (Google only serves it to that page). */
export async function fetchVideoViaTab(
  tabId: number,
  id: string,
  thumbUrl: string,
): Promise<VideoResult> {
  const res = await sendToTab(tabId, { type: 'video/fetch', id, thumbUrl });
  const video = res.video;
  if (!video) return { ok: false, reason: 'no-tab' };
  if (!video.ok) return video;
  if (!video.dataUrl.startsWith('data:video/')) return { ok: false, reason: 'unavailable' };
  return { ok: true, blob: await (await fetch(video.dataUrl)).blob() };
}

/**
 * Gets a video ready to stream: the Google Photos tab finds where Google serves it, and the
 * background worker plays it to the panel from an extension address (see shared/videoStream).
 */
export async function openVideoStreamViaTab(
  tabId: number,
  thumbUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: 'unavailable' }> {
  const res = await sendToTab(tabId, { type: 'video/open', thumbUrl });
  if (!res.stream) return { ok: false, reason: 'unavailable' };
  const token = crypto.randomUUID();
  const info: StreamInfo = { tabId, ...res.stream };
  await chrome.storage.session.set({ [`${STREAM_KEY}${token}`]: info });
  return { ok: true, url: chrome.runtime.getURL(`${STREAM_PATH.slice(1)}${token}`) };
}

/**
 * Puts Vault Tidy's page script into the tab. Needed when the tab was already open before the
 * extension was installed or reloaded (Chrome only adds content scripts to pages loaded later).
 */
export async function injectContentScript(tabId: number): Promise<void> {
  const files = chrome.runtime.getManifest().content_scripts?.flatMap((c) => c.js ?? []) ?? [];
  if (files.length === 0) throw new Error('No page script in the manifest');
  await chrome.scripting.executeScript({ target: { tabId }, files });
  // Give the script a moment to load its module and start listening.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export type AlbumOutcome = NonNullable<PanelResponse['album']>;

/** Exact sizes for these photos, looked up in the Google Photos tab (read-only). */
export async function fetchSizesViaTab(
  tabId: number,
  mediaKeys: string[],
): Promise<{ sizes: NonNullable<PanelResponse['sizes']>; error: string | null }> {
  const res = await sendToTab(tabId, { type: 'sizes/fetch', mediaKeys });
  return { sizes: res.sizes ?? {}, error: res.sizesError ?? null };
}

/** Asks the Google Photos tab to put these photos in a new private album. */
export async function addToNewAlbumViaTab(
  tabId: number,
  name: string,
  mediaKeys: string[],
): Promise<AlbumOutcome> {
  const res = await sendToTab(tabId, { type: 'album/add', name, mediaKeys });
  return res.album ?? { ok: false, error: 'The Google Photos tab did not answer' };
}

/** Remembers how many photos are waiting, for the monthly reminder badge (see background). */
export async function savePendingCount(count: number): Promise<void> {
  await chrome.storage.local.set({ pendingCount: count });
}

/** The panel is open, so the reminder has done its job. */
export async function clearBadge(): Promise<void> {
  await chrome.action?.setBadgeText({ text: '' });
}
