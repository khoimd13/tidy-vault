/**
 * Runs the CLIP model over scanned photos: loads the bundled model once, builds the text bank,
 * then embeds every photo that has no embedding yet (in small batches) and saves the result.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CLIP_MODEL_ID } from '../../ml/clip/protocol';
import { buildTextBank, type TextBank } from '../../ml/zeroShot';
import { CATEGORIES, KEEP_PROMPTS } from '../../shared/categories';
import type { PhotoItem } from '../../shared/types';
import * as store from '../../store/db';
import { ClipClient } from '../lib/clipClient';

/** Stored with each vector; change it when the model or its preprocessing changes. */
const MODEL_KEY = `${CLIP_MODEL_ID}:q8`;
/** Text prompt vectors are stored under their own key (id = the prompt text). */
const TEXT_KEY = `${MODEL_KEY}:text`;
const BATCH = 8;

export type AiStatus =
  | { state: 'loading' }
  | { state: 'ready'; device: string }
  | { state: 'unavailable'; message: string };

async function fetchThumb(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

const analysable = (i: PhotoItem) => i.kind === 'photo' && i.thumbUrl !== '';

export function useAnalysis(items: PhotoItem[]) {
  const [status, setStatus] = useState<AiStatus>({ state: 'loading' });
  const [bank, setBank] = useState<TextBank | null>(null);
  const [embeddings, setEmbeddings] = useState<Map<string, Float32Array>>(new Map());
  const [failedCount, setFailedCount] = useState(0);

  const client = useRef<ClipClient | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const embRef = useRef(embeddings);
  const failed = useRef(new Set<string>());
  const running = useRef(false);

  const commit = (next: Map<string, Float32Array>) => {
    embRef.current = next;
    setEmbeddings(next);
  };

  // Load saved vectors and the model once.
  useEffect(() => {
    let cancelled = false;
    const c = new ClipClient();
    client.current = c;
    void (async () => {
      try {
        const texts = [...CATEGORIES.flatMap((cat) => cat.prompts), ...KEEP_PROMPTS];
        const [saved, savedText] = await Promise.all([
          store.getEmbeddings(MODEL_KEY),
          store.getEmbeddings(TEXT_KEY),
        ]);
        if (cancelled) return;
        commit(new Map([...saved, ...embRef.current]));
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
          if (cancelled) return;
          setBank(buildTextBank(CATEGORIES, KEEP_PROMPTS, savedText));
        }
        if (cancelled) return;
        setStatus({ state: 'ready', device });
      } catch (err) {
        console.warn('Vault Tidy: AI model unavailable', err);
        if (!cancelled) {
          setStatus({ state: 'unavailable', message: err instanceof Error ? err.message : '' });
        }
      }
    })();
    return () => {
      cancelled = true;
      c.dispose();
      client.current = null;
    };
  }, []);

  // Analyse photos that have no vector yet. One loop at a time; it picks up new items as it goes.
  useEffect(() => {
    if (status.state !== 'ready' || running.current) return;
    running.current = true;
    void (async () => {
      try {
        for (;;) {
          const c = client.current;
          if (!c) break;
          const todo = itemsRef.current
            .filter((i) => analysable(i) && !embRef.current.has(i.id) && !failed.current.has(i.id))
            .slice(0, BATCH);
          if (todo.length === 0) break;

          const blobs = await Promise.all(todo.map((i) => fetchThumb(i.thumbUrl)));
          const ready = todo.filter((_, k) => blobs[k] !== null);
          const vectors = ready.length
            ? await c.embedImages(blobs.filter((b): b is Blob => b !== null))
            : [];

          const next = new Map(embRef.current);
          const toSave: store.StoredEmbedding[] = [];
          todo.forEach((item) => {
            const k = ready.indexOf(item);
            const vec = k >= 0 ? vectors[k] : null;
            if (vec) {
              next.set(item.id, vec);
              toSave.push({ id: item.id, model: MODEL_KEY, vec });
            } else {
              failed.current.add(item.id);
            }
          });
          commit(next);
          setFailedCount(failed.current.size);
          void store.putEmbeddings(toSave);
        }
      } catch (err) {
        console.warn('Vault Tidy: analysis stopped', err);
        setStatus({ state: 'unavailable', message: err instanceof Error ? err.message : '' });
      } finally {
        running.current = false;
      }
    })();
  }, [status, items]);

  const reset = useCallback(() => {
    failed.current.clear();
    setFailedCount(0);
    commit(new Map());
  }, []);

  const progress = useMemo(() => {
    const total = items.filter(analysable).length;
    const done = items.filter((i) => embeddings.has(i.id)).length;
    return { done, total, failed: failedCount };
  }, [items, embeddings, failedCount]);

  return { status, bank, embeddings, progress, reset };
}
