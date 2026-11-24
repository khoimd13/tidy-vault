/**
 * Zero-shot matching of an image embedding against text descriptions (pure math, no model).
 *
 * Each category is one label whose vector is the average of its prompt embeddings
 * ("prompt ensembling"). Everyday photo types ("a selfie", "a landscape photo", ...) are extra
 * background labels that are never suggested: a photo only counts as clutter when it looks more
 * like clutter than like a normal memory.
 */
import type { CategoryDef } from '../shared/types';

export interface PromptVec {
  categoryId: string;
  text: string;
  vec: Float32Array;
}

export interface Label {
  /** null for background (keep-worthy) labels. */
  categoryId: string | null;
  text: string;
  vec: Float32Array;
}

export interface TextBank {
  labels: Label[];
  prompts: PromptVec[];
}

export interface ZeroShotResult {
  categoryId: string;
  /** Softmax probability of this category among all labels, 0..1. */
  prob: number;
  /** The category prompt closest to the image, used to explain the suggestion. */
  bestPrompt: string;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

export function normalize(v: Float32Array): Float32Array {
  const n = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / n);
}

export function meanNormalized(vecs: readonly Float32Array[]): Float32Array {
  const first = vecs[0];
  if (!first) throw new Error('meanNormalized needs at least one vector');
  const sum = new Float32Array(first.length);
  for (const v of vecs) {
    const nv = normalize(v);
    for (let i = 0; i < sum.length; i++) sum[i] = (sum[i] ?? 0) + (nv[i] ?? 0);
  }
  return normalize(sum);
}

/** Builds the label set from categories, background prompts and their text embeddings. */
export function buildTextBank(
  categories: readonly CategoryDef[],
  background: readonly string[],
  embeddings: ReadonlyMap<string, Float32Array>,
): TextBank {
  const need = (text: string) => {
    const v = embeddings.get(text);
    if (!v) throw new Error(`Missing text embedding for "${text}"`);
    return v;
  };
  // Categories found another way (e.g. near-duplicates) have no prompts and take no part here.
  categories = categories.filter((c) => c.prompts.length > 0);
  const prompts: PromptVec[] = categories.flatMap((c) =>
    c.prompts.map((text) => ({ categoryId: c.id, text, vec: normalize(need(text)) })),
  );
  const labels: Label[] = [
    ...categories.map((c) => ({
      categoryId: c.id,
      text: c.name,
      vec: meanNormalized(c.prompts.map(need)),
    })),
    ...background.map((text) => ({ categoryId: null, text, vec: normalize(need(text)) })),
  ];
  return { labels, prompts };
}

/** CLIP's learned temperature is ~100. */
export const LOGIT_SCALE = 100;

/** Probabilities for each category (background labels take part but are not returned). */
export function zeroShot(
  image: Float32Array,
  bank: TextBank,
  scale = LOGIT_SCALE,
): ZeroShotResult[] {
  const img = normalize(image);
  const logits = bank.labels.map((l) => scale * dot(img, l.vec));
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const total = exps.reduce((a, b) => a + b, 0);

  const results: ZeroShotResult[] = [];
  bank.labels.forEach((label, i) => {
    if (label.categoryId === null) return;
    let best = '';
    let bestSim = -Infinity;
    for (const p of bank.prompts) {
      if (p.categoryId !== label.categoryId) continue;
      const sim = dot(img, p.vec);
      if (sim > bestSim) {
        bestSim = sim;
        best = p.text;
      }
    }
    results.push({ categoryId: label.categoryId, prob: (exps[i] ?? 0) / total, bestPrompt: best });
  });
  return results.sort((a, b) => b.prob - a.prob);
}
