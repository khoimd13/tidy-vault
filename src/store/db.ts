/** Local storage for scanned items, decisions and image embeddings (IndexedDB, extension only). */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Decision, PhotoItem } from '../shared/types';

export interface StoredEmbedding {
  id: string;
  /** Which model produced the vector, so a model change re-analyses photos. */
  model: string;
  vec: Float32Array;
}

interface VaultSchema extends DBSchema {
  items: { key: string; value: PhotoItem };
  decisions: { key: string; value: Decision };
  embeddings: { key: string; value: StoredEmbedding };
}

const DB_NAME = 'vault-tidy';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VaultSchema>> | null = null;

function db(): Promise<IDBPDatabase<VaultSchema>> {
  dbPromise ??= openDB<VaultSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('items', { keyPath: 'id' });
        database.createObjectStore('decisions', { keyPath: 'id' });
      }
      if (oldVersion < 2) database.createObjectStore('embeddings', { keyPath: 'id' });
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
  return (await getEmbeddingsByModel([model])).get(model) ?? new Map();
}

/** One read of the store, split by model. Vectors from models not asked for are ignored. */
export async function getEmbeddingsByModel(
  models: readonly string[],
): Promise<Map<string, Map<string, Float32Array>>> {
  const out = new Map(models.map((m) => [m, new Map<string, Float32Array>()]));
  for (const e of await (await db()).getAll('embeddings')) out.get(e.model)?.set(e.id, e.vec);
  return out;
}

export async function clearAll(): Promise<void> {
  const database = await db();
  await Promise.all([
    database.clear('items'),
    database.clear('decisions'),
    database.clear('embeddings'),
  ]);
}
