/** A photo or video tile read from the Google Photos grid. */
export interface PhotoItem {
  /** Google Photos media id, from the `/photo/<id>` link. */
  id: string;
  /** Absolute link that opens the item in Google Photos. */
  url: string;
  /** Thumbnail URL, resized for analysis and display. Empty when none was found. */
  thumbUrl: string;
  /** ISO date (yyyy-mm-dd) when it could be read from the page, else null. */
  takenAt: string | null;
  /**
   * When it was taken, in milliseconds (wall-clock time read as UTC; only differences matter).
   * Used to find near-duplicates. Missing for items scanned by older versions.
   */
  takenTs?: number | null;
  /** Tile width / height, or null when the tile had no size. */
  aspect: number | null;
  kind: 'photo' | 'video';
  /** Raw accessible label of the tile, kept for debugging selector changes. */
  label: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface CategoryDef {
  id: string;
  name: string;
  /** Tabler-style icon name, used by the UI only. */
  icon: string;
  /** Text descriptions for the image–text model (used once CLIP lands). */
  prompts: string[];
  /** True when this category can only be scored by the image model. */
  needsModel: boolean;
}

export interface CategoryScore {
  categoryId: string;
  /** 0..1 */
  score: number;
  /** Short human reasons, strongest first. */
  reasons: string[];
  /** Another photo this one relates to, e.g. the kept photo of a near-duplicate burst. */
  relatedId?: string;
}

export interface Suggestion {
  item: PhotoItem;
  categoryId: string;
  score: number;
  confidence: Confidence;
  reasons: string[];
  /** See CategoryScore.relatedId. */
  relatedId?: string;
}

export type DecisionKind = 'clutter' | 'keep';

export interface Decision {
  id: string;
  kind: DecisionKind;
  categoryId: string;
  /** Epoch milliseconds. */
  at: number;
}

export type ScanState = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
