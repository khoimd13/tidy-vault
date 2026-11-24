/** Promise wrapper around the CLIP Web Worker, including restart-on-failure. */
import type { WorkerRequest, WorkerResponse } from '../../ml/clip/protocol';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };

/**
 * Where bundled files live: the extension root (chrome-extension://…), or a root-relative path in
 * the UI preview. Not an http(s) URL on purpose: transformers.js treats those as remote and skips
 * them when only local models are allowed.
 */
export function assetUrl(path: string): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : `/${path}`;
}

type RequestBody<T extends WorkerRequest['type']> = Omit<Extract<WorkerRequest, { type: T }>, 'id'>;

export class ClipClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private disposed = false;

  private start(): Worker {
    const worker = new Worker(new URL('../../ml/clip/clip.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
    worker.onerror = (e) => this.rejectAll(new Error(e.message || 'The AI worker crashed'));
    this.worker = worker;
    return worker;
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.rejectAll(new Error('The AI worker was stopped'));
  }

  private rejectAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private request<T extends WorkerRequest['type']>(body: RequestBody<T>): Promise<WorkerResponse> {
    if (this.disposed) return Promise.reject(new Error('The AI worker was stopped'));
    const worker = this.worker ?? this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...body, id });
    });
  }

  private async load(forceWasm: boolean): Promise<string> {
    const res = await this.request<'init'>({
      type: 'init',
      modelBase: assetUrl('models/'),
      ortBase: assetUrl('ort/'),
      forceWasm,
    });
    return res.type === 'ready' ? res.device : 'unknown';
  }

  /**
   * Loads the bundled model, on WebGPU when the machine has a usable GPU. If that fails, retries
   * on WebAssembly in a fresh worker (a failed load poisons the old one). Resolves with the device.
   */
  async init(): Promise<string> {
    try {
      return await this.load(false);
    } catch (err) {
      if (this.disposed) throw err;
      console.warn('Vault Tidy: retrying the AI model on WebAssembly', err);
      return this.recover();
    }
  }

  /** After a failed run the worker can't be trusted: start a fresh one on WebAssembly. */
  async recover(): Promise<string> {
    this.stop();
    return this.load(true);
  }

  async embedText(texts: string[]): Promise<Float32Array[]> {
    const res = await this.request<'embedText'>({ type: 'embedText', texts });
    if (res.type !== 'vectors') throw new Error('Unexpected reply');
    return res.vectors.map((v) => v ?? new Float32Array());
  }

  async embedImages(images: Blob[]): Promise<(Float32Array | null)[]> {
    const res = await this.request<'embedImages'>({ type: 'embedImages', images });
    if (res.type !== 'vectors') throw new Error('Unexpected reply');
    return res.vectors;
  }

  /** Stops the worker; anything still waiting is rejected instead of hanging forever. */
  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}
