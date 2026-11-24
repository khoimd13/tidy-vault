/** Promise wrapper around the CLIP Web Worker. */
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
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL('../../ml/clip/clip.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
    this.worker.onerror = (e) => {
      const err = new Error(e.message || 'The AI worker crashed');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
  }

  private request<T extends WorkerRequest['type']>(body: RequestBody<T>): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id });
    });
  }

  /** Loads the bundled model. Resolves with the device used ("webgpu" or "wasm"). */
  async init(): Promise<string> {
    const res = await this.request<'init'>({
      type: 'init',
      modelBase: assetUrl('models/'),
      ortBase: assetUrl('ort/'),
    });
    return res.type === 'ready' ? res.device : 'unknown';
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

  dispose(): void {
    this.worker.terminate();
  }
}
