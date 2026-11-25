import type { PhotoItem, ScanState } from '../shared/types';

export interface ScanDeps {
  /** Items currently visible on the page. */
  readItems(): PhotoItem[];
  /** Scroll the grid one step further. */
  scrollStep(): void;
  /** True when the grid can't scroll any further (the real end of the library or album). */
  atEnd(): boolean;
  sleep(ms: number): Promise<void>;
  onItems(items: PhotoItem[]): void;
  onProgress(seen: number, state: ScanState): void;
  /** Called after every step, e.g. to save where the scan is for "Continue scan". */
  onStep?(): void;
}

export interface ScanOptions {
  /** Base pause between scroll steps, kept human-like on purpose. */
  stepDelayMs: number;
  /** Random extra pause, 0..jitterMs. */
  jitterMs: number;
  /** At the bottom: stop after this many steps in a row that found nothing new. */
  maxIdleSteps: number;
  /**
   * Not at the bottom yet but nothing new appears (Google is still loading): keep waiting, a
   * little longer each time, for up to this many steps before giving up.
   */
  maxIdleBeforeEnd: number;
  /** Extra wait per idle step while not at the bottom, capped at maxBackoffMs. */
  backoffMs: number;
  maxBackoffMs: number;
  /**
   * "Check for new photos": photos already scanned before. The scan stops once this many steps
   * in a row show only known photos (the newest photos are at the top).
   */
  known?: ReadonlySet<string>;
  knownStopSteps: number;
  random?: () => number;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  stepDelayMs: 600,
  jitterMs: 400,
  maxIdleSteps: 4,
  maxIdleBeforeEnd: 25,
  backoffMs: 350,
  maxBackoffMs: 3000,
  knownStopSteps: 3,
};

export type ScanEnd = 'end' | 'caught-up' | 'cancelled';

/** Scrolls through the grid, reporting each new item once. Supports pause, resume and cancel. */
export class Scanner {
  private state: ScanState = 'idle';
  /** id → whether we already reported it with a thumbnail. */
  private readonly seen = new Map<string, boolean>();
  private wake: (() => void) | null = null;

  constructor(
    private readonly deps: ScanDeps,
    private readonly opts: ScanOptions = DEFAULT_SCAN_OPTIONS,
  ) {}

  get status(): ScanState {
    return this.state;
  }

  get seenCount(): number {
    return this.seen.size;
  }

  pause(): void {
    if (this.state === 'running') this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.release();
  }

  cancel(): void {
    if (this.state !== 'running' && this.state !== 'paused') return;
    this.setState('cancelled');
    this.release();
  }

  async run(): Promise<ScanEnd> {
    if (this.state === 'running' || this.state === 'paused') {
      throw new Error('Scan already in progress');
    }
    this.setState('running');
    const random = this.opts.random ?? Math.random;
    const known = this.opts.known;
    let idle = 0;
    let onlyKnown = 0;

    for (;;) {
      if (this.status === 'cancelled') return 'cancelled';
      if (this.status === 'paused') {
        await new Promise<void>((resolve) => (this.wake = resolve));
        continue;
      }

      // New photos, plus photos seen before without a thumbnail that now have one (Google loads
      // images lazily, so the first reading of a tile can be empty).
      const visible = this.deps.readItems();
      let newIds = 0;
      let unknown = 0;
      const fresh = visible.filter((i) => {
        if (known && !known.has(i.id) && !this.seen.has(i.id)) unknown += 1;
        const had = this.seen.get(i.id);
        if (had === undefined) newIds += 1;
        return had === undefined || (!had && i.thumbUrl !== '');
      });
      for (const i of fresh) this.seen.set(i.id, i.thumbUrl !== '');
      if (fresh.length > 0) this.deps.onItems(fresh);
      idle = newIds > 0 ? 0 : idle + 1;
      this.deps.onProgress(this.seen.size, this.state);
      this.deps.onStep?.();

      // "Check for new photos": once the screen only shows photos scanned before, we're caught up.
      if (known && visible.length > 0) {
        onlyKnown = unknown === 0 ? onlyKnown + 1 : 0;
        if (onlyKnown >= this.opts.knownStopSteps) {
          this.setState('done');
          return 'caught-up';
        }
      }

      // Only stop at the real bottom; before that, an empty step just means Google is loading.
      const atEnd = this.deps.atEnd();
      if ((atEnd && idle >= this.opts.maxIdleSteps) || idle >= this.opts.maxIdleBeforeEnd) {
        this.setState('done');
        return 'end';
      }
      this.deps.scrollStep();
      const backoff = atEnd ? 0 : Math.min(this.opts.maxBackoffMs, idle * this.opts.backoffMs);
      await this.deps.sleep(
        this.opts.stepDelayMs + backoff + Math.floor(random() * this.opts.jitterMs),
      );
    }
  }

  private setState(next: ScanState): void {
    this.state = next;
    this.deps.onProgress(this.seen.size, next);
  }

  private release(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
}
