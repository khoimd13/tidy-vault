import type { PhotoItem, ScanState } from './types';

/** Messages the side panel sends to the content script in the Google Photos tab. */
export type PanelToContent =
  | { type: 'ping' }
  | { type: 'scan/start' }
  | { type: 'scan/pause' }
  | { type: 'scan/resume' }
  | { type: 'scan/cancel' };

/** The content script's reply to every PanelToContent message. */
export interface PanelResponse {
  ok: boolean;
  state: ScanState;
  seen: number;
  /** Only on `ping`: everything found on the page so far, so a reopened panel can catch up. */
  items?: PhotoItem[];
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
