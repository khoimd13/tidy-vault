/**
 * The "to remove" album: the only place Vault Tidy WRITES to Google Photos, and only by creating
 * one new private album and adding photos to it. It never deletes, trashes, archives or edits.
 *
 * Google's official API can't add existing photos to an album, so this uses the same internal
 * calls the Google Photos web app makes (documented by the open-source Google Photos Toolkit,
 * MIT licence): `OXvT9d` creates an album, `E1Cajb` adds items, `snAcKc` reads an album back.
 * Like the page reader, this can break when Google changes its site; it fails safely (nothing is
 * deleted) and the panel then falls back to the link list and CSV export.
 */

export interface Session {
  /** Anti-forgery token (WIZ_global_data.SNlM0e). */
  at: string;
  /** Session id (FdrFJe). */
  sid: string;
  /** Server build label (cfb2h). */
  bl: string;
  /** App path, e.g. "/_/PhotosUi/" (eptZe). */
  path: string;
}

/**
 * Reads the session values from the page's HTML. Content scripts can't see the page's JavaScript
 * variables, but the values are embedded in an inline script as `"KEY":"value"`.
 */
export function readSession(scriptTexts: readonly string[]): Session {
  const text = scriptTexts.find((t) => t.includes('WIZ_global_data')) ?? '';
  const pick = (key: string): string => {
    const m = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
    if (!m?.[1]) throw new Error(`Google Photos session value ${key} not found`);
    return JSON.parse(`"${m[1]}"`) as string;
  };
  return { at: pick('SNlM0e'), sid: pick('FdrFJe'), bl: pick('cfb2h'), path: pick('eptZe') };
}

export function buildRequest(
  session: Session,
  rpcid: string,
  data: unknown,
  sourcePath: string,
): { url: string; body: string } {
  const params = new URLSearchParams({
    rpcids: rpcid,
    'source-path': sourcePath,
    'f.sid': session.sid,
    bl: session.bl,
    pageId: 'none',
    rt: 'c',
  });
  const freq = JSON.stringify([[[rpcid, JSON.stringify(data), null, 'generic']]]);
  return {
    url: `https://photos.google.com${session.path}data/batchexecute?${params.toString()}`,
    body: `f.req=${encodeURIComponent(freq)}&at=${encodeURIComponent(session.at)}&`,
  };
}

/** Extracts the JSON payload from a batchexecute reply (the `wrb.fr` envelope line). */
export function parseReply(text: string): unknown {
  const line = text.split('\n').find((l) => l.includes('wrb.fr'));
  if (!line) throw new Error('Unexpected reply from Google Photos');
  const envelope = JSON.parse(line) as unknown[][];
  const payload = envelope[0]?.[2];
  if (typeof payload !== 'string') throw new Error('Google Photos refused the request');
  return JSON.parse(payload) as unknown;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function rpc(
  fetcher: Fetcher,
  session: Session,
  rpcid: string,
  data: unknown,
  sourcePath: string,
): Promise<unknown> {
  const { url, body } = buildRequest(session, rpcid, data, sourcePath);
  const res = await fetcher(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });
  if (!res.ok) throw new Error(`Google Photos answered ${res.status}`);
  return parseReply(await res.text());
}

const at = (v: unknown, ...path: number[]): unknown =>
  path.reduce<unknown>((cur, i) => (Array.isArray(cur) ? (cur[i] as unknown) : undefined), v);

/** Photo ids in links are Google's media keys (e.g. "AF1Qip…"). */
const MEDIA_KEY = /^[A-Za-z0-9_-]{10,}$/;
export const ALBUM_BATCH = 50;

export interface AlbumResult {
  albumKey: string;
  name: string;
  added: number;
  /** Count Google reports for the album afterwards, or null if it couldn't be read. */
  verifiedCount: number | null;
}

export interface AlbumDeps {
  fetcher: Fetcher;
  session: Session;
  sourcePath: string;
  sleep: (ms: number) => Promise<void>;
  onProgress?: (added: number, total: number) => void;
}

/** Creates a new private album named `name` and adds the photos to it, in batches. */
export async function addPhotosToNewAlbum(
  name: string,
  mediaKeys: readonly string[],
  deps: AlbumDeps,
): Promise<AlbumResult> {
  const keys = [...new Set(mediaKeys)].filter((k) => MEDIA_KEY.test(k));
  if (keys.length === 0) throw new Error('No photos to add');
  const call = (rpcid: string, data: unknown) =>
    rpc(deps.fetcher, deps.session, rpcid, data, deps.sourcePath);

  const created = await call('OXvT9d', [name, null, 2]);
  const albumKey = at(created, 0, 0);
  if (typeof albumKey !== 'string' || !MEDIA_KEY.test(albumKey)) {
    throw new Error("Google Photos didn't create the album");
  }

  let added = 0;
  for (let i = 0; i < keys.length; i += ALBUM_BATCH) {
    const batch = keys.slice(i, i + ALBUM_BATCH);
    await call('E1Cajb', [batch, albumKey]);
    added += batch.length;
    deps.onProgress?.(added, keys.length);
    if (added < keys.length) await deps.sleep(400);
  }

  // Read the album back to confirm; a failed read doesn't undo a successful add.
  const count = await call('snAcKc', [albumKey, null, null, null]).then(
    (page) => at(page, 3, 21),
    () => null,
  );
  return { albumKey, name, added, verifiedCount: typeof count === 'number' ? count : null };
}
