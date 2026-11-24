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
import { measureQuality, type Quality } from '../quality';
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

async function load(modelBase: string, ortBase: string, forceWasm: boolean): Promise<Loaded> {
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

  // One device per worker: transformers.js chains all session creation on one promise, so after a
  // failed WebGPU attempt nothing else can load in this worker. The client retries in a fresh
  // worker with `forceWasm` instead.
  const device = !forceWasm && (await hasUsableGpu()) ? 'webgpu' : 'wasm';
  const textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
    dtype: 'q8',
    device,
  });
  const visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
    dtype: 'q8',
    device,
  });
  return { tokenizer, textModel, processor, visionModel, device };
}

/** `'gpu' in navigator` is true even without a usable GPU; ask for an adapter to be sure. */
async function hasUsableGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
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

/** Size the quality thresholds were calibrated at (Google's thumbnails are fetched at this size). */
const QUALITY_SIZE = 224;

/** Measures quality on the image shrunk to fit 224 px, so results don't depend on input size. */
async function qualityOf(image: RawImage): Promise<Quality | null> {
  try {
    const scale = Math.min(1, QUALITY_SIZE / Math.max(image.width, image.height));
    const sized =
      scale < 1
        ? await image.resize(
            Math.max(3, Math.round(image.width * scale)),
            Math.max(3, Math.round(image.height * scale)),
          )
        : image.clone();
    const gray = sized.grayscale();
    return measureQuality(gray.data, gray.width, gray.height);
  } catch {
    return null;
  }
}

async function embedImages(
  m: Loaded,
  blobs: Blob[],
): Promise<{ vectors: (Float32Array | null)[]; quality: (Quality | null)[] }> {
  const images = await Promise.all(blobs.map((b) => RawImage.fromBlob(b).catch(() => null)));
  const quality = await Promise.all(
    images.map((img) => (img ? qualityOf(img) : Promise.resolve(null))),
  );
  const ok = images.filter((i): i is RawImage => i !== null);
  if (ok.length === 0) return { vectors: images.map(() => null), quality };
  const inputs = (await m.processor(ok)) as Record<string, unknown>;
  const { image_embeds } = (await m.visionModel(inputs)) as { image_embeds: Tensor };
  const vecs = rows(image_embeds);
  let k = 0;
  return { vectors: images.map((img) => (img === null ? null : (vecs[k++] ?? null))), quality };
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init': {
        loaded ??= load(msg.modelBase, msg.ortBase, msg.forceWasm);
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
        const { vectors, quality } = await embedImages(await loaded, msg.images);
        post({ type: 'vectors', id: msg.id, vectors, quality });
        break;
      }
    }
  } catch (err) {
    if (msg.type === 'init') loaded = null;
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
