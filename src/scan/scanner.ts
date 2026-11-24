import type { PhotoItem, ScanState } from '../shared/types';

export interface ScanDeps {
  /** Items currently visible on the page. */
  readItems(): PhotoItem[];
  /** Scroll the grid one step further. */
  scrollStep(): void;
  sleep(ms: number): Promise<void>;
  onItems(items: PhotoItem[]): void;
  onProgress(seen: number, state: ScanState): void;
}

export interface ScanOptions {
  /** Base pause between scroll steps, kept human-like on purpose. */
  stepDelayMs: number;
  /** Random extra pause, 0..jitterMs. */
  jitterMs: number;
  /** Stop after this many steps in a row that found nothing new. */
  maxIdleSteps: number;
  random?: () => number;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  stepDelayMs: 600,
  jitterMs: 400,
  maxIdleSteps: 6,
};

/** Scrolls through the grid, reporting each new item once. Supports pause, resume and cancel. */
export class Scanner {
  private state: ScanState = 'idle';
  private readonly seen = new Set<string>();
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

  async run(): Promise<'end' | 'cancelled'> {
    if (this.state === 'running' || this.state === 'paused') {
      throw new Error('Scan already in progress');
    }
    this.setState('running');
    const random = this.opts.random ?? Math.random;
    let idle = 0;

    for (;;) {
      if (this.status === 'cancelled') return 'cancelled';
      if (this.status === 'paused') {
        await new Promise<void>((resolve) => (this.wake = resolve));
        continue;
      }

      const fresh = this.deps.readItems().filter((i) => !this.seen.has(i.id));
      for (const i of fresh) this.seen.add(i.id);
      if (fresh.length > 0) {
        this.deps.onItems(fresh);
        idle = 0;
      } else {
        idle += 1;
      }
      this.deps.onProgress(this.seen.size, this.state);

      if (idle >= this.opts.maxIdleSteps) {
        this.setState('done');
        return 'end';
      }
      this.deps.scrollStep();
      await this.deps.sleep(this.opts.stepDelayMs + Math.floor(random() * this.opts.jitterMs));
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
