/** Content script on photos.google.com: runs the scanner and streams results to the side panel. */
import {
  fetchThumbnails,
  findScrollContainer,
  readVisibleItems,
  downloadVideo,
} from '../source/googlePhotosDom';
import { DEFAULT_SCAN_OPTIONS, Scanner } from '../scan/scanner';
import { addPhotosToNewAlbum, fetchSizes, readSession } from '../source/googlePhotosApi';
import {
  SCAN_PROGRESS_KEY,
  isPanelToContent,
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

function saveProgress(progress: ScanProgress): void {
  void chrome.storage.local.set({ [SCAN_PROGRESS_KEY]: progress }).catch(() => undefined);
}

async function savedProgress(): Promise<ScanProgress | null> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(SCAN_PROGRESS_KEY);
  const p = stored[SCAN_PROGRESS_KEY] as ScanProgress | undefined;
  return p && typeof p.top === 'number' ? p : null;
}

async function start(mode: ScanMode, knownIds: readonly string[]): Promise<void> {
  if (scanner && (scanner.status === 'running' || scanner.status === 'paused')) return;
  const container = findScrollContainer();
  const path = location.pathname;
  const previous = mode === 'resume' ? await savedProgress() : null;
  // Resume where the last scan of this same view stopped; otherwise start at the top.
  const resumeAt = previous && previous.path === path && !previous.finished ? previous.top : 0;
  container.scrollTo({ top: resumeAt });
  const startedWith = resumeAt > 0 ? (previous?.seen ?? 0) : 0;

  const current = new Scanner(
    {
      readItems: () => readVisibleItems(),
      scrollStep: () => container.scrollBy({ top: container.clientHeight * 0.8 }),
      atEnd: () => container.scrollTop + container.clientHeight >= container.scrollHeight - 4,
      onStep: () => {
        // "Check for new photos" doesn't move the bookmark of a full scan.
        if (mode !== 'new') {
          saveProgress({
            path,
            top: container.scrollTop,
            finished: false,
            seen: startedWith + (scanner?.seenCount ?? 0),
            at: Date.now(),
          });
        }
      },
      sleep,
      onItems: (items) => {
        for (const i of items) found.set(i.id, i);
        send({ type: 'scan/items', items });
      },
      onProgress: (seen, state) => send({ type: 'scan/progress', seen, state }),
    },
    mode === 'new' ? { ...DEFAULT_SCAN_OPTIONS, known: new Set(knownIds) } : DEFAULT_SCAN_OPTIONS,
  );
  scanner = current;
  current
    .run()
    .then((reason) => {
      if (reason === 'end' && mode !== 'new') {
        saveProgress({
          path,
          top: container.scrollTop,
          finished: true,
          seen: startedWith + current.seenCount,
          at: Date.now(),
        });
      }
      send({ type: 'scan/done', seen: current.seenCount, reason });
    })
    .catch((err: unknown) => send({ type: 'scan/error', message: String(err) }));
}

function status(): PanelResponse {
  return { ok: true, state: scanner?.status ?? 'idle', seen: scanner?.seenCount ?? 0 };
}

if (!alreadyLoaded)
  chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    if (!isPanelToContent(msg)) return;
    if (msg.type === 'sizes/fetch') {
      const scripts = Array.from(document.scripts, (s) => s.textContent ?? '');
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
      const scripts = Array.from(document.scripts, (s) => s.textContent ?? '');
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
        scanner?.cancel();
        break;
    }
    sendResponse({ ...status(), ...(msg.type === 'ping' ? { items: [...found.values()] } : {}) });
  });
