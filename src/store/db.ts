/** Local storage for scanned items, decisions and image embeddings (IndexedDB, extension only). */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Quality } from '../ml/quality';
import type { Decision, PhotoItem } from '../shared/types';

export interface StoredEmbedding {
  id: string;
  /** Which model produced the vector, so a model change re-analyses photos. */
  model: string;
  vec: Float32Array;
  /** Sharpness, brightness and contrast of the analysed thumbnail (image vectors only). */
  quality?: Quality | null;
}

interface VaultSchema extends DBSchema {
  items: { key: string; value: PhotoItem };
  decisions: { key: string; value: Decision };
  embeddings: { key: string; value: StoredEmbedding };
  /** Small thumbnails (fetched through the Google Photos tab), so screens can show them. */
  thumbs: { key: string; value: { id: string; blob: Blob } };
  /** Exact sizes from Google Photos (bytes), so the space estimate can use real numbers. */
  sizes: { key: string; value: StoredSize };
}

export interface StoredSize {
  id: string;
  size: number | null;
  spaceTaken: number | null;
}

const DB_NAME = 'vault-tidy';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<VaultSchema>> | null = null;

function db(): Promise<IDBPDatabase<VaultSchema>> {
  dbPromise ??= openDB<VaultSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('items', { keyPath: 'id' });
        database.createObjectStore('decisions', { keyPath: 'id' });
      }
      if (oldVersion < 2) database.createObjectStore('embeddings', { keyPath: 'id' });
      if (oldVersion < 3) database.createObjectStore('thumbs', { keyPath: 'id' });
      if (oldVersion < 4) database.createObjectStore('sizes', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function putItems(items: readonly PhotoItem[]): Promise<void> {
  if (items.length === 0) return;
  const tx = (await db()).transaction('items', 'readwrite');
  await Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
}

export async function getAllItems(): Promise<PhotoItem[]> {
  return (await db()).getAll('items');
}

export async function putDecisions(decisions: readonly Decision[]): Promise<void> {
  if (decisions.length === 0) return;
  const tx = (await db()).transaction('decisions', 'readwrite');
  await Promise.all([...decisions.map((d) => tx.store.put(d)), tx.done]);
}

export async function removeDecisions(ids: readonly string[]): Promise<void> {
  const tx = (await db()).transaction('decisions', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function getDecisions(): Promise<Map<string, Decision>> {
  const all = await (await db()).getAll('decisions');
  return new Map(all.map((d) => [d.id, d]));
}

export async function putEmbeddings(list: readonly StoredEmbedding[]): Promise<void> {
  if (list.length === 0) return;
  const tx = (await db()).transaction('embeddings', 'readwrite');
  await Promise.all([...list.map((e) => tx.store.put(e)), tx.done]);
}

/** Embeddings made by `model`; vectors from other models are ignored. */
export async function getEmbeddings(model: string): Promise<Map<string, Float32Array>> {
  const rows =
    (await getEmbeddingsByModel([model])).get(model) ?? new Map<string, StoredEmbedding>();
  return new Map([...rows].map(([id, e]) => [id, e.vec]));
}

/** One read of the store, split by model. Vectors from models not asked for are ignored. */
export async function getEmbeddingsByModel(
  models: readonly string[],
): Promise<Map<string, Map<string, StoredEmbedding>>> {
  const out = new Map(models.map((m) => [m, new Map<string, StoredEmbedding>()]));
  for (const e of await (await db()).getAll('embeddings')) out.get(e.model)?.set(e.id, e);
  return out;
}

export async function putThumbs(list: readonly { id: string; blob: Blob }[]): Promise<void> {
  if (list.length === 0) return;
  const tx = (await db()).transaction('thumbs', 'readwrite');
  await Promise.all([...list.map((t) => tx.store.put(t)), tx.done]);
}

/** Saved thumbnails for these ids (null where none is saved), in one transaction. */
export async function getThumbs(ids: readonly string[]): Promise<(Blob | null)[]> {
  const tx = (await db()).transaction('thumbs');
  const rows = await Promise.all(ids.map((id) => tx.store.get(id)));
  await tx.done;
  return rows.map((r) => r?.blob ?? null);
}

export async function getThumb(id: string): Promise<Blob | null> {
  return (await (await db()).get('thumbs', id))?.blob ?? null;
}

export async function putSizes(list: readonly StoredSize[]): Promise<void> {
  if (list.length === 0) return;
  const tx = (await db()).transaction('sizes', 'readwrite');
  await Promise.all([...list.map((s) => tx.store.put(s)), tx.done]);
}

export async function getSizes(): Promise<Map<string, StoredSize>> {
  const all = await (await db()).getAll('sizes');
  return new Map(all.map((s) => [s.id, s]));
}

export async function clearAll(): Promise<void> {
  const database = await db();
  await Promise.all([
    database.clear('items'),
    database.clear('decisions'),
    database.clear('embeddings'),
    database.clear('thumbs'),
    database.clear('sizes'),
  ]);
}
