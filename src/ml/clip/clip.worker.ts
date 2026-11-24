/**
 * Web Worker that runs CLIP (transformers.js + ONNX Runtime) off the UI thread.
 * Model and runtime files are bundled with the extension; nothing is fetched from the internet.
 */
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Processor,
  type Tensor,
} from '@huggingface/transformers';
// The 26 MB WebAssembly binary is emitted once by Vite; only its small JS loader lives in /ort.
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import { CLIP_MODEL_ID, type WorkerRequest, type WorkerResponse } from './protocol';

interface Loaded {
  tokenizer: PreTrainedTokenizer;
  textModel: PreTrainedModel;
  processor: Processor;
  visionModel: PreTrainedModel;
  device: string;
}

let loaded: Promise<Loaded> | null = null;

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

async function load(modelBase: string, ortBase: string): Promise<Loaded> {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = modelBase;
  env.useBrowserCache = false;
  // Load the runtime straight from the extension (no blob: imports, which MV3 forbids).
  env.useWasmCache = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = {
      mjs: `${ortBase}ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: new URL(ortWasmUrl, self.location.href).toString(),
    };
    wasm.numThreads = 1;
  }

  const tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL_ID);
  const processor = await AutoProcessor.from_pretrained(CLIP_MODEL_ID);

  const hasWebGpu = 'gpu' in navigator;
  for (const device of hasWebGpu ? (['webgpu', 'wasm'] as const) : (['wasm'] as const)) {
    try {
      const textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
        dtype: 'q8',
        device,
      });
      const visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
        dtype: 'q8',
        device,
      });
      return { tokenizer, textModel, processor, visionModel, device };
    } catch (err) {
      if (device === 'wasm') throw err;
      console.warn('Vault Tidy: WebGPU unavailable, falling back to WASM', err);
    }
  }
  throw new Error('No device available');
}

function rows(tensor: Tensor): Float32Array[] {
  const [n, d] = tensor.dims as [number, number];
  const data = tensor.data as Float32Array;
  return Array.from({ length: n }, (_, i) => data.slice(i * d, (i + 1) * d));
}

async function embedText(m: Loaded, texts: string[]): Promise<Float32Array[]> {
  const inputs = m.tokenizer(texts, { padding: true, truncation: true });
  const { text_embeds } = (await m.textModel(inputs)) as { text_embeds: Tensor };
  return rows(text_embeds);
}

async function embedImages(m: Loaded, blobs: Blob[]): Promise<(Float32Array | null)[]> {
  const images = await Promise.all(blobs.map((b) => RawImage.fromBlob(b).catch(() => null)));
  const ok = images.filter((i): i is RawImage => i !== null);
  if (ok.length === 0) return images.map(() => null);
  const inputs = (await m.processor(ok)) as Record<string, unknown>;
  const { image_embeds } = (await m.visionModel(inputs)) as { image_embeds: Tensor };
  const vecs = rows(image_embeds);
  let k = 0;
  return images.map((img) => (img === null ? null : (vecs[k++] ?? null)));
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init': {
        loaded ??= load(msg.modelBase, msg.ortBase);
        const m = await loaded;
        post({ type: 'ready', id: msg.id, device: m.device });
        break;
      }
      case 'embedText': {
        if (!loaded) throw new Error('Model not initialised');
        post({ type: 'vectors', id: msg.id, vectors: await embedText(await loaded, msg.texts) });
        break;
      }
      case 'embedImages': {
        if (!loaded) throw new Error('Model not initialised');
        post({ type: 'vectors', id: msg.id, vectors: await embedImages(await loaded, msg.images) });
        break;
      }
    }
  } catch (err) {
    if (msg.type === 'init') loaded = null;
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
