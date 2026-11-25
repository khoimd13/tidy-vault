/**
 * Copies the ONNX Runtime files into public/ort, writes public/THIRD_PARTY_NOTICES.txt and, with
 * --model, downloads the CLIP model into public/models. All are bundled into the extension so it never loads code or models
 * from the internet at runtime (MV3 forbids remote code; it also keeps the privacy promise).
 *
 *   node scripts/prepare-assets.mjs           # runtime files only (fast, runs before dev/build)
 *   node scripts/prepare-assets.mjs --model   # also download the model (~155 MB, once)
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile, rename } from 'node:fs/promises';
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

/**
 * Everything third-party that ships inside the extension, with its license text. The licenses
 * (MIT, ISC, Apache-2.0, OFL-1.1) require the notice to travel with the code, so it is written
 * to public/THIRD_PARTY_NOTICES.txt and bundled.
 */
const BUNDLED_PACKAGES = [
  'preact',
  'idb',
  '@huggingface/transformers',
  '@huggingface/jinja',
  '@huggingface/tokenizers',
  'onnxruntime-web',
  'onnxruntime-common',
  '@fontsource/be-vietnam-pro',
  '@fontsource/space-grotesk',
];

const mit = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/** Packages published without a license file: the text their license field points to. */
const LICENSE_FALLBACK = {
  'onnxruntime-web': mit('Microsoft Corporation'),
  'onnxruntime-common': mit('Microsoft Corporation'),
};

async function licenseText(dir, name) {
  const files = (await readdir(dir)).filter((f) => /^(licen[cs]e|notice)/i.test(f)).sort();
  const texts = await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8')));
  const text = texts.join('\n\n').trim();
  if (text) return text;
  const fallback = LICENSE_FALLBACK[name];
  if (!fallback) throw new Error(`No license text found for ${name}`);
  return fallback.trim();
}

async function writeNotices() {
  const parts = [
    'Vault Tidy includes the following third-party software and model.',
    'Vault Tidy is not affiliated with, endorsed by, or sponsored by Google.',
  ];
  for (const name of BUNDLED_PACKAGES) {
    const dir = join(root, 'node_modules', name);
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    parts.push(
      `${'='.repeat(72)}\n${name} ${pkg.version} (${pkg.license})\n${'='.repeat(72)}\n\n${await licenseText(dir, name)}`,
    );
  }
  parts.push(
    `${'='.repeat(72)}\nCLIP ViT-B/32 model (${MODEL_ID}, ONNX conversion of openai/clip-vit-base-patch32) (MIT)\nhttps://github.com/openai/CLIP\n${'='.repeat(72)}\n\n${mit('2021 OpenAI').trim()}`,
  );
  await writeFile(join(root, 'public', 'THIRD_PARTY_NOTICES.txt'), `${parts.join('\n\n')}\n`);
  console.log(
    `notices: wrote ${BUNDLED_PACKAGES.length + 1} entries to public/THIRD_PARTY_NOTICES.txt`,
  );
}

await copyOrt();
await writeNotices();
if (process.argv.includes('--model')) await fetchModel();
