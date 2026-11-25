import type { PhotoItem, ScanState } from './types';

export type ScanMode = 'full' | 'resume' | 'new';

/** Saved in chrome.storage.local after every scan step, so a scan can continue later. */
export interface ScanProgress {
  /** The Google Photos view that was being scanned (library, a search, an album). */
  path: string;
  /** How far down the grid the scan got, in pixels. */
  top: number;
  /** True once the scan reached the end of that view. */
  finished: boolean;
  /** Photos found in that scan so far. */
  seen: number;
  at: number;
}

export const SCAN_PROGRESS_KEY = 'scanProgress';

/** Messages the side panel sends to the content script in the Google Photos tab. */
export type PanelToContent =
  | { type: 'ping' }
  /**
   * full: from the top through everything; resume: from where the last scan stopped;
   * new: from the top until only already-scanned photos appear (`knownIds`).
   */
  | { type: 'scan/start'; mode?: ScanMode; knownIds?: string[] }
  | { type: 'scan/pause' }
  | { type: 'scan/resume' }
  | { type: 'scan/cancel' }
  /** Download thumbnails in the page, where the Google session applies. */
  | { type: 'thumbs/fetch'; urls: string[] }
  /** Download a video (360p) so the panel can play it; progress arrives as `video/progress`. */
  | { type: 'video/fetch'; id: string; thumbUrl: string }
  /** Create a new private album with these photos (the only write; never deletes anything). */
  | { type: 'album/add'; name: string; mediaKeys: string[] }
  /** Look up exact file sizes (read-only). */
  | { type: 'sizes/fetch'; mediaKeys: string[] };

/** The content script's reply to every PanelToContent message. */
export interface PanelResponse {
  ok: boolean;
  state: ScanState;
  seen: number;
  /** Only on `ping`: everything found on the page so far, so a reopened panel can catch up. */
  items?: PhotoItem[];
  /** Only on `thumbs/fetch`: a data: URL per requested URL, or null when it failed. */
  thumbs?: (string | null)[];
  /** Only on `video/fetch`: the video as a data: URL, or why there is none. */
  video?: { ok: true; dataUrl: string } | { ok: false; reason: 'unavailable' | 'too-big' };
  /** Only on `sizes/fetch`: size and storage taken per media key. */
  sizes?: Record<string, { size: number | null; spaceTaken: number | null }>;
  /** Only on `sizes/fetch`: why no exact sizes came back, when that happens. */
  sizesError?: string;
  /** Only on `album/add`. */
  album?:
    | { ok: true; name: string; added: number; verifiedCount: number | null }
    | { ok: false; error: string };
}

/** Messages the content script sends back to the side panel. */
export type ContentToPanel =
  | { type: 'scan/items'; items: PhotoItem[] }
  | { type: 'scan/progress'; seen: number; state: ScanState }
  | { type: 'scan/done'; seen: number; reason: 'end' | 'caught-up' | 'cancelled' }
  | { type: 'scan/error'; message: string }
  | { type: 'video/progress'; id: string; loaded: number; total: number | null };

const PANEL_TYPES = new Set<string>([
  'ping',
  'scan/start',
  'scan/pause',
  'scan/resume',
  'scan/cancel',
  'thumbs/fetch',
  'video/fetch',
  'album/add',
  'sizes/fetch',
]);
const CONTENT_TYPES = new Set<string>([
  'scan/items',
  'scan/progress',
  'scan/done',
  'scan/error',
  'video/progress',
]);

function typeOf(msg: unknown): string | null {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return null;
  return typeof msg.type === 'string' ? msg.type : null;
}

export function isPanelToContent(msg: unknown): msg is PanelToContent {
  const t = typeOf(msg);
  return t !== null && PANEL_TYPES.has(t);
}

export function isContentToPanel(msg: unknown): msg is ContentToPanel {
  const t = typeOf(msg);
  return t !== null && CONTENT_TYPES.has(t);
}
