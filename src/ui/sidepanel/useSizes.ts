/**
 * Exact sizes: loads saved sizes, then asks the Google Photos tab (read-only) for photos that
 * don't have one yet. Photos Google returns nothing for are not asked again this session.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhotoItem } from '../../shared/types';
import * as store from '../../store/db';

/** Asks for a batch of sizes; throws when the tab can't answer right now. */
export type SizeFetcher = (
  ids: string[],
) => Promise<Record<string, { size: number | null; spaceTaken: number | null }>>;

/** Photos per message to the tab (the page script asks Google 100 at a time). */
const CHUNK = 300;

export function useSizes(items: PhotoItem[], fetchSizes: SizeFetcher | null) {
  const [sizes, setSizes] = useState<Map<string, store.StoredSize>>(new Map());
  const sizesRef = useRef(sizes);
  const asked = useRef(new Set<string>());
  const running = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    void store.getSizes().then((saved) => {
      sizesRef.current = new Map([...saved, ...sizesRef.current]);
      setSizes(sizesRef.current);
    });
  }, []);

  useEffect(() => {
    if (!fetchSizes || running.current) return;
    running.current = true;
    void (async () => {
      try {
        for (;;) {
          const todo = itemsRef.current
            .map((i) => i.id)
            .filter((id) => !sizesRef.current.has(id) && !asked.current.has(id))
            .slice(0, CHUNK);
          if (todo.length === 0) break;
          for (const id of todo) asked.current.add(id);
          let reply;
          try {
            reply = await fetchSizes(todo);
          } catch {
            for (const id of todo) asked.current.delete(id); // tab gone: retry when it's back
            break;
          }
          const fresh = Object.entries(reply).map(([id, s]) => ({ id, ...s }));
          if (fresh.length === 0) continue;
          void store.putSizes(fresh);
          sizesRef.current = new Map([
            ...sizesRef.current,
            ...fresh.map((s) => [s.id, s] as const),
          ]);
          setSizes(sizesRef.current);
        }
      } finally {
        running.current = false;
      }
    })();
  }, [items, fetchSizes]);

  const reset = () => {
    asked.current.clear();
    sizesRef.current = new Map();
    setSizes(sizesRef.current);
  };

  return { sizes, reset };
}
