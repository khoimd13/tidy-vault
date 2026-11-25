/**
 * Streaming videos into the side panel. Google only serves video files to photos.google.com, so
 * the panel's <video> plays an extension address (`vt-stream/<token>`) that the background
 * worker answers, piece by piece, by asking the Google Photos tab for each range of bytes.
 */

/** URL path prefix the background worker answers. */
export const STREAM_PATH = '/vt-stream/';
/** chrome.storage.session key prefix for a registered stream. */
export const STREAM_KEY = 'stream:';
/** Largest piece read per request: big enough to play smoothly, small enough to start fast. */
export const STREAM_CHUNK = 1_500_000;

export interface StreamInfo {
  tabId: number;
  url: string;
  total: number;
  type: string;
}

/**
 * The byte range to answer for a `Range` header (`bytes=start-` or `bytes=start-end`), capped at
 * one chunk. Null when the range can't be satisfied.
 */
export function pickRange(
  header: string | null,
  total: number,
  chunk = STREAM_CHUNK,
): { start: number; end: number } | null {
  let start = 0;
  let end = total - 1;
  if (header) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!m) return null;
    if (m[1] === '' && m[2] !== '') {
      // "bytes=-500": the last 500 bytes.
      start = Math.max(0, total - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== '') end = Math.min(end, Number(m[2]));
    }
  }
  if (!Number.isFinite(start) || start >= total || end < start) return null;
  return { start, end: Math.min(end, start + chunk - 1) };
}

/** Base64 → bytes. */
export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Bytes `start..end` as a stream that reads one piece at a time (via `read`) only as the reader
 * wants more, one piece ahead. Throws inside the stream if a piece can't be read.
 */
export function pieceStream(
  start: number,
  end: number,
  read: (from: number, to: number) => Promise<Uint8Array | null>,
  chunk = STREAM_CHUNK,
): ReadableStream<Uint8Array> {
  let pos = start;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (pos > end) {
          controller.close();
          return;
        }
        const piece = await read(pos, Math.min(end, pos + chunk - 1));
        if (!piece || piece.byteLength === 0) {
          controller.error(new Error('Google stopped sending the video'));
          return;
        }
        pos += piece.byteLength;
        controller.enqueue(piece);
      },
    },
    { highWaterMark: 1 },
  );
}
