/**
 * Answers the side panel's <video> requests for `vt-stream/<token>`, reading the video through
 * the Google Photos tab (see shared/videoStream).
 *
 * Each request is answered with the whole range the player asked for, as a stream that reads
 * the next piece from the tab only when the player wants more. (Answering with just one piece
 * made Chrome's player treat that piece as the end of the video: it stopped after a second.)
 */
import type { PanelResponse, PanelToContent } from '../shared/messages';
import {
  STREAM_CHUNK,
  STREAM_KEY,
  STREAM_PATH,
  fromBase64,
  pickRange,
  pieceStream,
  type StreamInfo,
} from '../shared/videoStream';

interface FetchEventLike {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

/** One piece of the video, read through the Google Photos tab; null when Google refused. */
async function readPiece(info: StreamInfo, start: number, end: number): Promise<Uint8Array | null> {
  const msg: PanelToContent = { type: 'video/range', url: info.url, start, end };
  const res = await chrome.tabs.sendMessage<PanelToContent, PanelResponse>(info.tabId, msg);
  return typeof res.chunk === 'string' ? fromBase64(res.chunk) : null;
}

async function answer(request: Request, token: string): Promise<Response> {
  const key = `${STREAM_KEY}${token}`;
  const stored: Record<string, unknown> = await chrome.storage.session.get(key);
  const info = stored[key] as StreamInfo | undefined;
  if (!info) return new Response('Unknown video', { status: 404 });

  // The whole range asked for (usually "from here to the end"), not capped at one piece.
  const range = pickRange(request.headers.get('range'), info.total, Infinity);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${info.total}` },
    });
  }
  const { start, end } = range;

  // Read the first piece before answering, so a refusal is reported as an error right away.
  const firstEnd = Math.min(end, start + STREAM_CHUNK - 1);
  const first = await readPiece(info, start, firstEnd);
  if (!first || first.byteLength === 0) return new Response('Google refused', { status: 502 });
  let firstPending: Uint8Array | null = first;
  const body = pieceStream(start, end, (from, to) => {
    if (firstPending && from === start) {
      const piece = firstPending;
      firstPending = null;
      return Promise.resolve(piece);
    }
    return readPiece(info, from, to);
  });

  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': info.type,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${info.total}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

export function listenForVideoStreams(): void {
  const worker = self as unknown as {
    addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
  };
  worker.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith(STREAM_PATH)) return;
    const token = url.pathname.slice(STREAM_PATH.length);
    event.respondWith(
      answer(event.request, token).catch(
        (err: unknown) => new Response(String(err), { status: 502 }),
      ),
    );
  });
}
