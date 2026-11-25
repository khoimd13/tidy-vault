import type { PhotoItem, ScanState } from './types';

/** Messages the side panel sends to the content script in the Google Photos tab. */
export type PanelToContent =
  | { type: 'ping' }
  | { type: 'scan/start' }
  | { type: 'scan/pause' }
  | { type: 'scan/resume' }
  | { type: 'scan/cancel' }
  /** Download thumbnails in the page, where the Google session applies. */
  | { type: 'thumbs/fetch'; urls: string[] }
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
  | { type: 'scan/done'; seen: number; reason: 'end' | 'cancelled' }
  | { type: 'scan/error'; message: string };

const PANEL_TYPES = new Set<string>([
  'ping',
  'scan/start',
  'scan/pause',
  'scan/resume',
  'scan/cancel',
  'thumbs/fetch',
  'album/add',
  'sizes/fetch',
]);
const CONTENT_TYPES = new Set<string>(['scan/items', 'scan/progress', 'scan/done', 'scan/error']);

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
