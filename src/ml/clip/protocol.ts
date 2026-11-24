/** Messages between the side panel and the CLIP Web Worker. */

export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';

export type WorkerRequest =
  | { type: 'init'; id: number; modelBase: string; ortBase: string }
  | { type: 'embedText'; id: number; texts: string[] }
  | { type: 'embedImages'; id: number; images: Blob[] };

export type WorkerResponse =
  | { type: 'ready'; id: number; device: string }
  | { type: 'vectors'; id: number; vectors: (Float32Array | null)[] }
  | { type: 'error'; id: number; message: string };
