/** Content script on photos.google.com: runs the scanner and streams results to the side panel. */
import {
  fetchThumbnails,
  findScrollContainer,
  readVisibleItems,
  downloadVideo,
  fetchVideoRange,
  findVideoStream,
} from '../source/googlePhotosDom';
import { DEFAULT_SCAN_OPTIONS, Scanner } from '../scan/scanner';
import {
  addPhotosToNewAlbum,
  fetchSizes,
  readAccount,
  readSession,
} from '../source/googlePhotosApi';
import {
  isPanelToContent,
  scanProgressKey,
  type ContentToPanel,
  type PanelResponse,
  type ScanMode,
  type ScanProgress,
} from '../shared/messages';
import type { PhotoItem } from '../shared/types';

/** The panel may inject this script again into a tab that already has it; run only once. */
const loadedFlag = '__vaultTidyLoaded';
const alreadyLoaded = (globalThis as Record<string, unknown>)[loadedFlag] === true;
(globalThis as Record<string, unknown>)[loadedFlag] = true;

let scanner: Scanner | null = null;
/** Everything found on this page, so a panel that was closed mid-scan can catch up on `ping`. */
const found = new Map<string, PhotoItem>();

function send(msg: ContentToPanel): void {
  // The panel may be closed; that's fine, it catches up from `found` when it pings again.
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read the video'));
    reader.onerror = () => reject(new Error('Could not read the video'));
    reader.readAsDataURL(blob);
  });
}

const pageScripts = () => Array.from(document.scripts, (s) => s.textContent ?? '');

/**
 * Who is signed in to this page; each Google account keeps its own scan bookmark. Switching
 * account loads a new page (and a new copy of this script), so it is read once.
 */
let pageAccount: ReturnType<typeof readAccount> | undefined;
const account = () => {
  pageAccount ??= readAccount(pageScripts()) ?? undefined;
  return pageAccount ?? null;
};
const progressKey = () => scanProgressKey(account()?.id ?? null);

function saveProgress(progress: ScanProgress): void {
  void chrome.storage.local.set({ [progressKey()]: progress }).catch(() => undefined);
}

async function savedProgress(): Promise<ScanProgress | null> {
  const key = progressKey();
  const stored: Record<string, unknown> = await chrome.storage.local.get(key);
  const p = stored[key] as ScanProgress | undefined;
  return p && typeof p.top === 'number' ? p : null;
}

/**
 * Runs one pass of the scanner from the current position. `bookmark` saves where it got to (for
 * "Continue scan"); `base` is added to the counts so a two-part scan counts up smoothly.
 */
async function pass(
  container: Element,
  path: string,
  opts: {
    known?: ReadonlySet<string>;
    bookmark: boolean;
    base: number;
    bookmarkBase: number;
    /** More follows this pass, so its end isn't reported as the end of the scan. */
    more?: boolean;
  },
) {
  const current = new Scanner(
    {
      readItems: () => readVisibleItems(),
      scrollStep: () => container.scrollBy({ top: container.clientHeight * 0.8 }),
      atEnd: () => container.scrollTop + container.clientHeight >= container.scrollHeight - 4,
      onStep: () => {
        if (!opts.bookmark) return;
        saveProgress({
          path,
          top: container.scrollTop,
          finished: false,
          seen: opts.bookmarkBase + current.seenCount,
          at: Date.now(),
        });
      },
      sleep,
      onItems: (items) => {
        for (const i of items) found.set(i.id, i);
        send({ type: 'scan/items', items });
      },
      onProgress: (seen, state) =>
        send({
          type: 'scan/progress',
          seen: opts.base + seen,
          state: opts.more && state === 'done' ? 'running' : state,
        }),
    },
    opts.known ? { ...DEFAULT_SCAN_OPTIONS, known: opts.known } : DEFAULT_SCAN_OPTIONS,
  );
  scanner = current;
  const reason = await current.run();
  if (reason === 'end' && opts.bookmark) {
    saveProgress({
      path,
      top: container.scrollTop,
      finished: true,
      seen: opts.bookmarkBase + current.seenCount,
      at: Date.now(),
    });
  }
  return { reason, seen: current.seenCount };
}

/** Waits for Google to draw the grid after a jump (it fills a new spot in about a second). */
async function jumpTo(container: Element, top: number): Promise<void> {
  // Right after a long jump the page still shows the old spot, so wait before reading.
  const far = Math.abs(container.scrollTop - top) > container.clientHeight;
  container.scrollTo({ top });
  if (far) await sleep(1500);
}

let starting = false;
/** Stop pressed between the two parts of an update scan (no scanner is running then). */
let stopRequested = false;

async function start(mode: ScanMode, knownIds: readonly string[]): Promise<void> {
  if (starting || (scanner && (scanner.status === 'running' || scanner.status === 'paused'))) {
    return;
  }
  starting = true;
  stopRequested = false;
  try {
    const container = findScrollContainer();
    const path = location.pathname;
    const saved = await savedProgress();
    // A full scan of this same view that stopped part-way.
    const unfinished = saved && saved.path === path && !saved.finished ? saved : null;
    const known = new Set(knownIds);

    if (mode === 'new' || mode === 'update') {
      // New photos are at the top: read until only photos scanned before are on screen. Without
      // an earlier scan that's simply a full scan, so then it keeps the bookmark too.
      const fresh = known.size === 0;
      await jumpTo(container, 0);
      const first = await pass(container, path, {
        ...(fresh ? {} : { known }),
        bookmark: fresh,
        base: 0,
        bookmarkBase: 0,
        more: mode === 'update' && unfinished !== null && !fresh,
      });
      // "update": then jump straight to where the last full scan stopped and finish it.
      if (mode === 'update' && first.reason === 'caught-up' && unfinished) {
        await jumpTo(container, unfinished.top);
        if (stopRequested) {
          send({ type: 'scan/done', seen: first.seen, reason: 'cancelled' });
          return;
        }
        const rest = await pass(container, path, {
          bookmark: true,
          base: first.seen,
          bookmarkBase: unfinished.seen,
        });
        send({ type: 'scan/done', seen: first.seen + rest.seen, reason: rest.reason });
        return;
      }
      send({ type: 'scan/done', seen: first.seen, reason: first.reason });
      return;
    }

    // resume: from where the last scan of this view stopped; full: from the top.
    const from = mode === 'resume' && unfinished ? unfinished : null;
    await jumpTo(container, from?.top ?? 0);
    const result = await pass(container, path, {
      bookmark: true,
      base: 0,
      bookmarkBase: from?.seen ?? 0,
    });
    send({ type: 'scan/done', seen: result.seen, reason: result.reason });
  } catch (err) {
    send({ type: 'scan/error', message: String(err) });
  } finally {
    starting = false;
  }
}

function status(): PanelResponse {
  return { ok: true, state: scanner?.status ?? 'idle', seen: scanner?.seenCount ?? 0 };
}

if (!alreadyLoaded)
  chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    if (!isPanelToContent(msg)) return;
    if (msg.type === 'sizes/fetch') {
      const scripts = pageScripts();
      void (async () => {
        try {
          const sizes = await fetchSizes(msg.mediaKeys, {
            fetcher: (url, init) => fetch(url, init),
            session: readSession(scripts),
            sourcePath: location.pathname,
            sleep,
          });
          const matched = msg.mediaKeys.filter((k) => sizes.has(k)).length;
          // Explain an empty or mismatched answer instead of failing silently.
          const sizesError =
            matched > 0
              ? undefined
              : sizes.size === 0
                ? `Google returned no sizes for ${msg.mediaKeys.length} photos`
                : `Google returned ${sizes.size} sizes, but for different photo IDs`;
          if (sizesError) {
            console.warn('Vault Tidy: exact sizes', sizesError, {
              asked: msg.mediaKeys.slice(0, 3),
              returned: [...sizes.keys()].slice(0, 3),
            });
          }
          sendResponse({
            ...status(),
            sizes: Object.fromEntries(sizes),
            ...(sizesError ? { sizesError } : {}),
          });
        } catch (err) {
          console.warn('Vault Tidy: exact sizes failed', err);
          sendResponse({ ...status(), sizes: {}, sizesError: String(err) });
        }
      })();
      return true;
    }
    if (msg.type === 'album/add') {
      const scripts = pageScripts();
      void (async () => {
        try {
          const result = await addPhotosToNewAlbum(msg.name, msg.mediaKeys, {
            fetcher: (url, init) => fetch(url, init),
            session: readSession(scripts),
            sourcePath: location.pathname,
            sleep,
          });
          sendResponse({ ...status(), album: { ok: true, ...result } });
        } catch (err) {
          sendResponse({ ...status(), album: { ok: false, error: String(err) } });
        }
      })();
      return true;
    }
    if (msg.type === 'video/open') {
      void findVideoStream(msg.thumbUrl).then((stream) => sendResponse({ ...status(), stream }));
      return true;
    }
    if (msg.type === 'video/range') {
      void fetchVideoRange(msg.url, msg.start, msg.end).then(async (bytes) => {
        const chunk = bytes
          ? ((await blobToDataUrl(new Blob([bytes as BlobPart]))).split(',')[1] ?? null)
          : null;
        sendResponse({ ...status(), chunk });
      });
      return true;
    }
    if (msg.type === 'video/fetch') {
      const { id, thumbUrl } = msg;
      let lastSent = 0;
      void (async () => {
        const result = await downloadVideo(thumbUrl, {
          onProgress: (loaded, total) => {
            // A few updates a second is plenty for a progress bar.
            if (Date.now() - lastSent < 250) return;
            lastSent = Date.now();
            send({ type: 'video/progress', id, loaded, total });
          },
        });
        const video = result.ok
          ? { ok: true as const, dataUrl: await blobToDataUrl(result.blob) }
          : result;
        sendResponse({ ...status(), video });
      })();
      return true;
    }
    if (msg.type === 'thumbs/fetch') {
      void fetchThumbnails(msg.urls).then((thumbs) => sendResponse({ ...status(), thumbs }));
      return true; // keeps the message channel open for the async reply
    }
    switch (msg.type) {
      case 'ping':
        break;
      case 'scan/start':
        void start(msg.mode ?? 'full', msg.knownIds ?? []);
        break;
      case 'scan/pause':
        scanner?.pause();
        break;
      case 'scan/resume':
        scanner?.resume();
        break;
      case 'scan/cancel':
        stopRequested = true;
        scanner?.cancel();
        break;
    }
    sendResponse({
      ...status(),
      ...(msg.type === 'ping' ? { items: [...found.values()], account: account() } : {}),
    });
  });
