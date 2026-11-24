/**
 * Copies the ONNX Runtime files into public/ort and, with --model, downloads the CLIP model
 * into public/models. Both are bundled into the extension so it never loads code or models
 * from the internet at runtime (MV3 forbids remote code; it also keeps the privacy promise).
 *
 *   node scripts/prepare-assets.mjs           # runtime files only (fast, runs before dev/build)
 *   node scripts/prepare-assets.mjs --model   # also download the model (~155 MB, once)
 */
import { copyFile, mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Only the small JS loader; the WebAssembly binary is bundled by Vite from the worker import.
const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.mjs'];

export const MODEL_ID = 'Xenova/clip-vit-base-patch32';
const MODEL_FILES = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/vision_model_quantized.onnx',
  'onnx/text_model_quantized.onnx',
];

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function copyOrt() {
  const out = join(root, 'public', 'ort');
  await mkdir(out, { recursive: true });
  for (const f of ORT_FILES) {
    await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', f), join(out, f));
  }
  console.log(`ort: copied ${ORT_FILES.length} files to public/ort`);
}

async function fetchModel() {
  const out = join(root, 'public', 'models', MODEL_ID);
  for (const f of MODEL_FILES) {
    const dest = join(out, f);
    if (await exists(dest)) {
      console.log(`model: ${f} already present`);
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    const url = `https://huggingface.co/${MODEL_ID}/resolve/main/${f}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
    const tmp = `${dest}.part`;
    await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
    await rename(tmp, dest);
    console.log(`model: downloaded ${f}`);
  }
}

await copyOrt();
if (process.argv.includes('--model')) await fetchModel();
