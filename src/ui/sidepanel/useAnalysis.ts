/**
 * Runs the CLIP model over scanned photos: loads the bundled model once, builds the text bank,
 * then embeds every photo that has no embedding yet (in small batches) and saves the result.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Analysis } from '../../ml/clipClassifier';
import { CLIP_MODEL_ID } from '../../ml/clip/protocol';
import { buildTextBank, type TextBank } from '../../ml/zeroShot';
import { CATEGORIES, KEEP_PROMPTS } from '../../shared/categories';
import type { PhotoItem } from '../../shared/types';
import * as store from '../../store/db';
import { ClipClient } from '../lib/clipClient';

/**
 * Stored with each image vector; change it when the model, its preprocessing or what is measured
 * changes (v2 adds sharpness/brightness/contrast), so photos are analysed again.
 */
const MODEL_KEY = `${CLIP_MODEL_ID}:q8:v2`;
/** Text prompt vectors are stored under their own key (id = the prompt text). */
const TEXT_KEY = `${CLIP_MODEL_ID}:q8:text`;
const BATCH = 8;
/** Re-render at most this often while analysing; every batch re-scores the whole library. */
const COMMIT_EVERY_MS = 700;
/** Give up after this many failed batches in a row (each one restarts the worker first). */
const MAX_FAILED_BATCHES = 3;

export type AiStatus =
  | { state: 'loading' }
  | { state: 'ready'; device: string }
  | { state: 'unavailable'; message: string };

/** Downloads thumbnails; null entries are failures. Throws if downloading isn't possible now. */
export type ThumbFetcher = (urls: string[]) => Promise<(Blob | null)[]>;

/** Photos, and videos by their cover frame. */
const analysable = (i: PhotoItem) => i.thumbUrl !== '';
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * @param fetchThumbs downloads thumbnails through the Google Photos tab, or null while no such
 *   tab is connected (analysis then waits instead of marking photos as failed).
 */
export function useAnalysis(items: PhotoItem[], fetchThumbs: ThumbFetcher | null) {
  const [status, setStatus] = useState<AiStatus>({ state: 'loading' });
  const [bank, setBank] = useState<TextBank | null>(null);
  const [embeddings, setEmbeddings] = useState<Map<string, Analysis>>(new Map());
  /** Thumbnail URLs that couldn't be loaded. Keyed by URL, so a rescan with a fresh URL retries. */
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set());

  const client = useRef<ClipClient | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** Always current, even between throttled re-renders. */
  const embRef = useRef(embeddings);
  const failedRef = useRef(new Set<string>());
  const running = useRef(false);
  const alive = useRef(true);
  /** Bumped by reset(); results from an older generation are dropped, not saved. */
  const generation = useRef(0);

  const publish = useCallback(() => {
    setEmbeddings(embRef.current);
    setFailedUrls(new Set(failedRef.current));
  }, []);

  // Load saved vectors and the model once.
  useEffect(() => {
    alive.current = true;
    const c = new ClipClient();
    client.current = c;
    void (async () => {
      try {
        const texts = [...CATEGORIES.flatMap((cat) => cat.prompts), ...KEEP_PROMPTS];
        const saved = await store.getEmbeddingsByModel([MODEL_KEY, TEXT_KEY]);
        const savedImages = new Map(
          [...(saved.get(MODEL_KEY) ?? new Map<string, store.StoredEmbedding>())].map(
            ([id, e]): [string, Analysis] => [id, { vec: e.vec, quality: e.quality ?? null }],
          ),
        );
        const savedText = new Map(
          [...(saved.get(TEXT_KEY) ?? new Map<string, store.StoredEmbedding>())].map(
            ([id, e]): [string, Float32Array] => [id, e.vec],
          ),
        );
        if (!alive.current) return;
        embRef.current = new Map([...savedImages, ...embRef.current]);
        publish();
        // Saved text vectors let saved results show instantly, before the model has loaded.
        if (texts.every((t) => savedText.has(t))) {
          setBank(buildTextBank(CATEGORIES, KEEP_PROMPTS, savedText));
        }

        const device = await c.init();
        const missing = texts.filter((t) => !savedText.has(t));
        if (missing.length > 0) {
          const vectors = await c.embedText(missing);
          const fresh = missing.map((t, i) => ({
            id: t,
            model: TEXT_KEY,
            vec: vectors[i] ?? new Float32Array(),
          }));
          void store.putEmbeddings(fresh);
          for (const f of fresh) savedText.set(f.id, f.vec);
          if (!alive.current) return;
          setBank(buildTextBank(CATEGORIES, KEEP_PROMPTS, savedText));
        }
        if (alive.current) setStatus({ state: 'ready', device });
      } catch (err) {
        console.warn('Vault Tidy: AI model unavailable', err);
        if (alive.current) setStatus({ state: 'unavailable', message: message(err) });
      }
    })();
    return () => {
      alive.current = false;
      c.dispose();
      client.current = null;
    };
  }, [publish]);

  // Analyse photos that have no vector yet. One loop at a time; it picks up new items as it goes.
  useEffect(() => {
    if (status.state !== 'ready' || running.current || !fetchThumbs) return;
    running.current = true;
    void (async () => {
      let failedBatches = 0;
      let lastPublish = Date.now();
      try {
        while (alive.current) {
          const c = client.current;
          if (!c) break;
          const gen = generation.current;
          const todo = itemsRef.current
            .filter(
              (i) =>
                analysable(i) && !embRef.current.has(i.id) && !failedRef.current.has(i.thumbUrl),
            )
            .slice(0, BATCH);
          if (todo.length === 0) break;

          // Re-use thumbnails saved by an earlier analysis; only download the missing ones.
          const blobs = await store.getThumbs(todo.map((i) => i.id));
          const missing = todo.flatMap((item, k) => (blobs[k] ? [] : [k]));
          if (missing.length > 0) {
            let fetched: (Blob | null)[];
            try {
              fetched = await fetchThumbs(missing.map((k) => todo[k]?.thumbUrl ?? ''));
            } catch {
              break; // The Google Photos tab went away; resume when it's back.
            }
            missing.forEach((k, n) => (blobs[k] = fetched[n] ?? null));
          }
          const ready = todo.filter((_, k) => blobs[k] !== null);
          let vectors: (Float32Array | null)[] = [];
          let quality: (Analysis['quality'] | null)[] = [];
          try {
            if (ready.length) {
              ({ vectors, quality } = await c.embedImages(
                blobs.filter((b): b is Blob => b !== null),
              ));
            }
            failedBatches = 0;
          } catch (err) {
            if (!alive.current) break;
            failedBatches += 1;
            console.warn('Vault Tidy: analysis batch failed, restarting the AI worker', err);
            if (failedBatches >= MAX_FAILED_BATCHES) throw err;
            await c.recover();
            // Retry the same batch once; on a second failure, skip these photos.
            if (failedBatches < 2) continue;
          }
          if (!alive.current || gen !== generation.current) continue;

          const next = new Map(embRef.current);
          const toSave: store.StoredEmbedding[] = [];
          todo.forEach((item) => {
            const k = ready.indexOf(item);
            const vec = k >= 0 ? vectors[k] : null;
            if (vec) {
              const q = quality[k] ?? null;
              next.set(item.id, { vec, quality: q });
              toSave.push({ id: item.id, model: MODEL_KEY, vec, quality: q });
            } else {
              failedRef.current.add(item.thumbUrl);
            }
          });
          embRef.current = next;
          void store.putEmbeddings(toSave);
          void store.putThumbs(
            todo.flatMap((item, k) => {
              const blob = blobs[k];
              return blob && next.has(item.id) ? [{ id: item.id, blob }] : [];
            }),
          );
          if (Date.now() - lastPublish >= COMMIT_EVERY_MS) {
            publish();
            lastPublish = Date.now();
          }
        }
      } catch (err) {
        console.warn('Vault Tidy: analysis stopped', err);
        if (alive.current) setStatus({ state: 'unavailable', message: message(err) });
      } finally {
        running.current = false;
        if (alive.current) publish();
      }
    })();
  }, [status, items, publish, fetchThumbs]);

  const reset = useCallback(() => {
    generation.current += 1;
    failedRef.current.clear();
    embRef.current = new Map();
    publish();
  }, [publish]);

  const progress = useMemo(() => {
    const photos = items.filter(analysable);
    /** Photos the page reader found no thumbnail for: the AI can't look at these at all. */
    const noThumbnail = items.filter((i) => i.kind === 'photo' && i.thumbUrl === '').length;
    let done = 0;
    let failed = 0;
    for (const i of photos) {
      if (embeddings.has(i.id)) done += 1;
      else if (failedUrls.has(i.thumbUrl)) failed += 1;
    }
    return { done, total: photos.length, failed, noThumbnail };
  }, [items, embeddings, failedUrls]);

  return { status, bank, embeddings, progress, reset };
}
