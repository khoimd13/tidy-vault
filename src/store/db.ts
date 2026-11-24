/** Local storage for scanned items and decisions (IndexedDB, extension origin only). */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Decision, PhotoItem } from '../shared/types';

interface VaultSchema extends DBSchema {
  items: { key: string; value: PhotoItem };
  decisions: { key: string; value: Decision };
}

const DB_NAME = 'vault-tidy';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VaultSchema>> | null = null;

function db(): Promise<IDBPDatabase<VaultSchema>> {
  dbPromise ??= openDB<VaultSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('items', { keyPath: 'id' });
      database.createObjectStore('decisions', { keyPath: 'id' });
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

export async function clearAll(): Promise<void> {
  const database = await db();
  await Promise.all([database.clear('items'), database.clear('decisions')]);
}
