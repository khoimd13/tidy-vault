/** Content script on photos.google.com: runs the scanner and streams results to the side panel. */
import { fetchThumbnails, findScrollContainer, readVisibleItems } from '../source/googlePhotosDom';
import { DEFAULT_SCAN_OPTIONS, Scanner } from '../scan/scanner';
import { isPanelToContent, type ContentToPanel, type PanelResponse } from '../shared/messages';
import type { PhotoItem } from '../shared/types';

let scanner: Scanner | null = null;
/** Everything found on this page, so a panel that was closed mid-scan can catch up on `ping`. */
const found = new Map<string, PhotoItem>();

function send(msg: ContentToPanel): void {
  // The panel may be closed; that's fine, it catches up from `found` when it pings again.
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function start(): void {
  if (scanner && (scanner.status === 'running' || scanner.status === 'paused')) return;
  const container = findScrollContainer();
  container.scrollTo({ top: 0 });

  const current = new Scanner(
    {
      readItems: () => readVisibleItems(),
      scrollStep: () => container.scrollBy({ top: container.clientHeight * 0.8 }),
      sleep,
      onItems: (items) => {
        for (const i of items) found.set(i.id, i);
        send({ type: 'scan/items', items });
      },
      onProgress: (seen, state) => send({ type: 'scan/progress', seen, state }),
    },
    DEFAULT_SCAN_OPTIONS,
  );
  scanner = current;
  current
    .run()
    .then((reason) => send({ type: 'scan/done', seen: current.seenCount, reason }))
    .catch((err: unknown) => send({ type: 'scan/error', message: String(err) }));
}

function status(): PanelResponse {
  return { ok: true, state: scanner?.status ?? 'idle', seen: scanner?.seenCount ?? 0 };
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isPanelToContent(msg)) return;
  if (msg.type === 'thumbs/fetch') {
    void fetchThumbnails(msg.urls).then((thumbs) => sendResponse({ ...status(), thumbs }));
    return true; // keeps the message channel open for the async reply
  }
  switch (msg.type) {
    case 'ping':
      break;
    case 'scan/start':
      start();
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
