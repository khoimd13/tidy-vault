/**
 * Answers the side panel's <video> requests for `vt-stream/<token>` with pieces of the video,
 * read through the Google Photos tab (see shared/videoStream).
 */
import type { PanelResponse, PanelToContent } from '../shared/messages';
import {
  STREAM_KEY,
  STREAM_PATH,
  fromBase64,
  pickRange,
  type StreamInfo,
} from '../shared/videoStream';

interface FetchEventLike {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

async function answer(request: Request, token: string): Promise<Response> {
  const key = `${STREAM_KEY}${token}`;
  const stored: Record<string, unknown> = await chrome.storage.session.get(key);
  const info = stored[key] as StreamInfo | undefined;
  if (!info) return new Response('Unknown video', { status: 404 });

  const range = pickRange(request.headers.get('range'), info.total);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${info.total}` },
    });
  }
  const msg: PanelToContent = { type: 'video/range', url: info.url, ...range };
  const res = await chrome.tabs.sendMessage<PanelToContent, PanelResponse>(info.tabId, msg);
  if (typeof res.chunk !== 'string') return new Response('Google refused', { status: 502 });
  const bytes = fromBase64(res.chunk);
  return new Response(bytes, {
    status: 206,
    headers: {
      'Content-Type': info.type,
      'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes ${range.start}-${range.start + bytes.byteLength - 1}/${info.total}`,
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
