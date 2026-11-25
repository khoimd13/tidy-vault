/**
 * Keeps each Google account's results apart. Every account gets its own database and scan
 * bookmark; the panel switches when the Google Photos tab is signed in to another account.
 *
 * Results saved before this existed (one shared database) go to the first account seen.
 */
import { SCAN_PROGRESS_KEY, scanProgressKey, type PageAccount } from '../../shared/messages';
import { DEFAULT_DB_NAME, selectDatabase } from '../../store/db';

const ACCOUNTS_KEY = 'accounts';
const LAST_ACCOUNT_KEY = 'lastAccount';

interface KnownAccount {
  db: string;
  email: string | null;
}

type Known = Record<string, KnownAccount>;

async function known(): Promise<Known> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(ACCOUNTS_KEY);
  return (stored[ACCOUNTS_KEY] as Known | undefined) ?? {};
}

/** The account the panel showed last, so it opens on the same results without the tab. */
export async function lastAccount(): Promise<PageAccount | null> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(LAST_ACCOUNT_KEY);
  const last = stored[LAST_ACCOUNT_KEY] as PageAccount | undefined;
  return last && typeof last.id === 'string' ? last : null;
}

/**
 * Makes this account's database the one the store uses, creating it the first time (the first
 * account ever seen takes over the results saved before accounts were kept apart).
 */
export async function openAccount(account: PageAccount): Promise<void> {
  const accounts = await known();
  let entry = accounts[account.id];
  if (!entry) {
    const first = Object.keys(accounts).length === 0;
    entry = { db: first ? DEFAULT_DB_NAME : `${DEFAULT_DB_NAME}:${account.id}`, email: null };
    if (first) {
      // The old shared scan bookmark belongs with the old shared results.
      const old: Record<string, unknown> = await chrome.storage.local.get(SCAN_PROGRESS_KEY);
      if (old[SCAN_PROGRESS_KEY]) {
        await chrome.storage.local.set({ [scanProgressKey(account.id)]: old[SCAN_PROGRESS_KEY] });
        await chrome.storage.local.remove(SCAN_PROGRESS_KEY);
      }
    }
  }
  entry = { ...entry, email: account.email ?? entry.email };
  await chrome.storage.local.set({
    [ACCOUNTS_KEY]: { ...accounts, [account.id]: entry },
    [LAST_ACCOUNT_KEY]: { id: account.id, email: entry.email },
  });
  selectDatabase(entry.db);
}
