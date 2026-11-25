/** All side panel state in one hook: the Google Photos tab, scan progress, items and decisions. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { heuristicClassifier, noSuggestions } from '../../ml/classifier';
import { createClipClassifier } from '../../ml/clipClassifier';
import { findNearDuplicates } from '../../ml/duplicates';
import { buildFeedback, withFeedback } from '../../ml/feedback';
import { isEmptyImage } from '../../ml/quality';
import {
  isContentToPanel,
  scanProgressKey,
  type PageAccount,
  type PanelToContent,
  type ScanMode,
  type ScanProgress,
} from '../../shared/messages';
import type { Decision, DecisionKind, PhotoItem, ScanState, Suggestion } from '../../shared/types';
import * as store from '../../store/db';
import { buildCleanupList } from '../../suggest/cleanupList';
import { buildSuggestions, groupSuggestions } from '../../suggest/suggestions';
import {
  addToNewAlbumViaTab,
  fetchSizesViaTab,
  fetchThumbsViaTab,
  fetchVideoViaTab,
  openVideoStreamViaTab,
  type AlbumOutcome,
  findPhotosTabId,
  injectContentScript,
  sendToTab,
} from '../lib/chromeApi';
import { clearThumbCache } from './components/Thumb';
import { useAnalysis } from './useAnalysis';
import { useSizes } from './useSizes';

/** A video ready to play (an object URL), or why it can't be played here. */
export type VideoLoad =
  { ok: true; url: string } | { ok: false; reason: 'unavailable' | 'too-big' | 'no-tab' };

export interface ScanStatus {
  state: ScanState;
  seen: number;
}

/** Shown translated by the panel; `detail` is the technical reason, kept as-is. */
export interface VaultError {
  code: 'notConnected' | 'scanError';
  detail: string;
}

function mergeItems(prev: PhotoItem[], next: PhotoItem[]): PhotoItem[] {
  const byId = new Map(prev.map((i) => [i.id, i]));
  for (const i of next) byId.set(i.id, i);
  return [...byId.values()];
}

/**
 * `account` is the Google account whose results are shown (null before any is known). When the
 * Google Photos tab turns out to be signed in to another account, `onAccount` is called instead
 * of mixing that account's photos in; the panel then starts over on that account's results.
 */
export function useVault(account: PageAccount | null, onAccount: (account: PageAccount) => void) {
  const accountId = account?.id ?? null;
  const [tabId, setTabId] = useState<number | null>(null);
  const tabIdRef = useRef<number | null>(null);
  tabIdRef.current = tabId;
  /** Bumped when the Photos tab finishes loading, so we reconnect to its fresh content script. */
  const [tabLoads, setTabLoads] = useState(0);
  const [scan, setScan] = useState<ScanStatus>({ state: 'idle', seen: 0 });
  const [items, setItems] = useState<PhotoItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [error, setError] = useState<VaultError | null>(null);
  /** Bumped on every successful ping, so work that stopped while disconnected starts again. */
  const [connection, setConnection] = useState(0);

  const addItems = useCallback((next: PhotoItem[]) => {
    if (next.length === 0) return;
    void store.putItems(next);
    setItems((prev) => mergeItems(prev, next));
  }, []);

  // Load saved data, merging with anything that arrived while the database was opening.
  useEffect(() => {
    void (async () => {
      const [savedItems, savedDecisions] = await Promise.all([
        store.getAllItems(),
        store.getDecisions(),
      ]);
      setItems((prev) => mergeItems(savedItems, prev));
      setDecisions((prev) => new Map([...savedDecisions, ...prev]));
    })();
  }, []);

  useEffect(() => {
    const refresh = () => void findPhotosTabId().then(setTabId);
    const onUpdated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      refresh();
      if (change.status === 'complete' && id === tabIdRef.current) setTabLoads((n) => n + 1);
    };
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  useEffect(() => {
    const onMessage = (msg: unknown, sender: chrome.runtime.MessageSender) => {
      // Only listen to the Google Photos tab this panel is connected to.
      if (!isContentToPanel(msg) || sender.tab?.id !== tabIdRef.current) return;
      switch (msg.type) {
        case 'scan/items':
          addItems(msg.items);
          break;
        case 'scan/progress':
          setScan({ state: msg.state, seen: msg.seen });
          break;
        case 'scan/done':
          setScan({ state: msg.reason === 'cancelled' ? 'cancelled' : 'done', seen: msg.seen });
          setLastEnd(msg.reason);
          break;
        case 'scan/error':
          setError({ code: 'scanError', detail: msg.message });
          break;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [addItems]);

  const command = useCallback(
    async (
      type: Extract<
        PanelToContent['type'],
        'ping' | 'scan/start' | 'scan/pause' | 'scan/resume' | 'scan/cancel'
      >,
      extra: Omit<Extract<PanelToContent, { type: 'scan/start' }>, 'type'> = {},
    ) => {
      if (tabId === null) return;
      const send = async () => {
        const res = await sendToTab(tabId, type === 'scan/start' ? { type, ...extra } : { type });
        if (!res || typeof res.state !== 'string') throw new Error('The page sent no reply');
        return res;
      };
      try {
        let res;
        try {
          res = await send();
        } catch {
          // Vault Tidy's page script isn't there (e.g. the tab was open before the extension was
          // installed or reloaded): put it in now and try once more.
          await injectContentScript(tabId);
          res = await send();
        }
        if (type === 'ping' && res.account && res.account.id !== accountId) {
          onAccount(res.account);
          return;
        }
        setScan({ state: res.state, seen: res.seen });
        if (res.items) addItems(res.items);
        if (type === 'ping') setConnection((n) => n + 1);
        setError(null);
      } catch (err) {
        console.warn('Vault Tidy: cannot reach the Google Photos tab', err);
        setError({
          code: 'notConnected',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [tabId, addItems, accountId, onAccount],
  );

  /** How the last scan ended, e.g. 'caught-up' after "Check for new photos" found nothing new. */
  const [lastEnd, setLastEnd] = useState<'end' | 'caught-up' | 'cancelled' | null>(null);

  /** Where the last full scan got to, for "Continue scan" (shared with the page script). */
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  useEffect(() => {
    const key = scanProgressKey(accountId);
    const load = () =>
      void chrome.storage.local.get(key).then((s: Record<string, unknown>) => {
        setProgress((s[key] as ScanProgress | undefined) ?? null);
      });
    load();
    const onChanged = (changes: Record<string, unknown>) => {
      if (key in changes) load();
    };
    chrome.storage.onChanged?.addListener(onChanged);
    return () => chrome.storage.onChanged?.removeListener(onChanged);
  }, [accountId]);

  const startScan = useCallback(
    (mode: ScanMode) => {
      setLastEnd(null);
      return command('scan/start', {
        mode,
        ...(mode === 'new' || mode === 'update'
          ? { knownIds: itemsRef.current.map((i) => i.id) }
          : {}),
      });
    },
    [command],
  );

  // Connect to the tab: learn its scan state and catch up on items found while the panel was closed.
  useEffect(() => {
    if (tabId === null) {
      setError(null);
      return;
    }
    void command('ping');
  }, [tabId, tabLoads, command]);

  // Thumbnails can only be downloaded through a connected Google Photos tab.
  const fetchThumbs = useMemo(
    () =>
      tabId === null || connection === 0
        ? null
        : (urls: string[]) => fetchThumbsViaTab(tabId, urls),
    [tabId, connection],
  );
  const ai = useAnalysis(items, fetchThumbs);

  // Exact sizes from Google Photos (read-only), fetched quietly once connected.
  const fetchSizes = useMemo(
    () =>
      tabId === null || connection === 0 ? null : (ids: string[]) => fetchSizesViaTab(tabId, ids),
    [tabId, connection],
  );
  const sizes = useSizes(items, fetchSizes);

  // With the AI: only analysed photos are suggested (they appear as analysis runs), so the cruder
  // shape rule never shows wrong suggestions that then disappear. Without it: shape rule only.
  // If the model stops part-way, photos it already analysed keep their AI results.
  // Bursts of near-identical photos: all but the sharpest of each group are suggested.
  const duplicates = useMemo(
    () =>
      findNearDuplicates(
        items.flatMap((i) => {
          const a = ai.embeddings.get(i.id);
          // Empty images (blank, very dark) are handled as empty, not grouped as a "burst".
          return a && i.kind === 'photo' && !(a.quality && isEmptyImage(a.quality))
            ? [
                {
                  id: i.id,
                  takenTs: i.takenTs,
                  takenAt: i.takenAt,
                  vec: a.vec,
                  sharpness: a.quality?.sharpness ?? 0,
                },
              ]
            : [];
        }),
      ),
    [items, ai.embeddings],
  );

  // Learning from Keep / Add decisions. Rebuilt only when decisions change or a decided photo gets
  // its vector, not on every analysis batch.
  const decidedWithVectors = useMemo(() => {
    let n = 0;
    for (const id of decisions.keys()) if (ai.embeddings.has(id)) n += 1;
    return n;
  }, [decisions, ai.embeddings]);
  const feedback = useMemo(
    () => buildFeedback(decisions, ai.embeddings),
    // ai.embeddings is read but deliberately not a dependency: only the count above matters.
    [decisions, decidedWithVectors],
  );

  const classifier = useMemo(() => {
    const unanalysed = ai.status.state === 'unavailable' ? heuristicClassifier : noSuggestions;
    const base = ai.bank
      ? createClipClassifier(ai.bank, ai.embeddings, unanalysed, duplicates)
      : unanalysed;
    return withFeedback(base, feedback, ai.embeddings);
  }, [ai.status.state, ai.bank, ai.embeddings, duplicates, feedback]);

  const groups = useMemo(
    () => groupSuggestions(buildSuggestions(items, classifier, decisions, new Date())),
    [items, classifier, decisions],
  );

  const decide = useCallback(async (list: Suggestion[], kind: DecisionKind) => {
    const made: Decision[] = list.map((s) => ({
      id: s.item.id,
      kind,
      categoryId: s.categoryId,
      at: Date.now(),
    }));
    await store.putDecisions(made);
    setDecisions((prev) => new Map([...prev, ...made.map((d) => [d.id, d] as const)]));
    return made.map((d) => d.id);
  }, []);

  /** Puts back decisions exactly as they were (used to undo a removal). */
  const restore = useCallback(async (list: Decision[]) => {
    await store.putDecisions(list);
    setDecisions((prev) => new Map([...prev, ...list.map((d) => [d.id, d] as const)]));
  }, []);

  const undo = useCallback(async (ids: string[]) => {
    await store.removeDecisions(ids);
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  /**
   * A larger version of a photo for the detail view, downloaded through the Google Photos tab
   * (Google's image links need the session). Object URLs are cached for the panel's lifetime.
   */
  const largeCache = useRef(new Map<string, Promise<string | null>>());
  const largeImage = useCallback(
    (item: PhotoItem): Promise<string | null> => {
      const cached = largeCache.current.get(item.id);
      if (cached) return cached;
      if (tabId === null || !/=w\d+-h\d+/.test(item.thumbUrl)) return Promise.resolve(null);
      const url = item.thumbUrl.replace(/=w\d+-h\d+/, '=w1200-h1200');
      const loading = fetchThumbsViaTab(tabId, [url])
        .then(([blob]) => (blob ? URL.createObjectURL(blob) : null))
        .catch(() => null);
      largeCache.current.set(item.id, loading);
      return loading;
    },
    [tabId],
  );

  /**
   * A video to play in the panel. Google only serves videos to the Google Photos tab, so by
   * default the background worker streams it through that tab (it starts at once and can seek).
   * `download` fetches the whole file instead: the fallback for short videos if streaming fails.
   * The last few are remembered so going back and forth is instant.
   */
  const videoCache = useRef(new Map<string, { at: number; load: Promise<VideoLoad> }>());
  const videoStream = useCallback(
    (
      item: PhotoItem,
      onProgress?: (fraction: number | null) => void,
      how: 'stream' | 'download' = 'stream',
    ): Promise<VideoLoad> => {
      const key = `${how}:${item.id}`;
      const cache = videoCache.current;
      const cached = cache.get(key);
      // Google's links expire after a few hours; an hour is a safe reuse window.
      if (cached && Date.now() - cached.at < 60 * 60_000) return cached.load;
      if (tabId === null || item.kind !== 'video' || !item.thumbUrl) {
        return Promise.resolve({ ok: false, reason: 'unavailable' });
      }
      let load: Promise<VideoLoad>;
      if (how === 'stream') {
        load = openVideoStreamViaTab(tabId, item.thumbUrl).catch((): VideoLoad => ({
          ok: false,
          reason: 'no-tab',
        }));
      } else {
        const onMessage = (msg: unknown, sender: chrome.runtime.MessageSender) => {
          if (!isContentToPanel(msg) || msg.type !== 'video/progress' || msg.id !== item.id) return;
          if (sender.tab?.id !== tabId) return;
          onProgress?.(msg.total ? Math.min(1, msg.loaded / msg.total) : null);
        };
        chrome.runtime.onMessage.addListener(onMessage);
        load = fetchVideoViaTab(tabId, item.id, item.thumbUrl)
          .then((r): VideoLoad => (r.ok ? { ok: true, url: URL.createObjectURL(r.blob) } : r))
          .catch((): VideoLoad => ({ ok: false, reason: 'no-tab' }))
          .finally(() => chrome.runtime.onMessage.removeListener(onMessage));
      }
      cache.set(key, { at: Date.now(), load });
      void load.then((r) => {
        // A failure may work later (tab reloaded), so don't keep it.
        if (!r.ok) cache.delete(key);
      });
      // Keep memory in check: forget (and free) the oldest beyond the last few.
      while (cache.size > 8) {
        const [oldKey, old] = cache.entries().next().value ?? [];
        if (oldKey === undefined || !old) break;
        cache.delete(oldKey);
        void old.load.then((r) => r.ok && r.url.startsWith('blob:') && URL.revokeObjectURL(r.url));
      }
      return load;
    },
    [tabId],
  );

  /** Puts the given photos in a new private album in Google Photos (never deletes anything). */
  const makeAlbum = useCallback(
    async (name: string, ids: string[]): Promise<AlbumOutcome> => {
      if (tabId === null) return { ok: false, error: 'Open Google Photos in this window first' };
      try {
        return await addToNewAlbumViaTab(tabId, name, ids);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [tabId],
  );

  const clearAll = useCallback(async () => {
    await store.clearAll();
    setItems([]);
    setDecisions(new Map());
    ai.reset();
    sizes.reset();
    clearThumbCache();
  }, [ai.reset]);

  const counts = useMemo(() => {
    let clutter = 0;
    let kept = 0;
    for (const d of decisions.values()) {
      if (d.kind === 'clutter') clutter += 1;
      else kept += 1;
    }
    return { clutter, kept };
  }, [decisions]);

  const cleanup = useMemo(() => buildCleanupList(items, decisions), [items, decisions]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  return {
    onPhotos: tabId !== null,
    account,
    scan,
    scanProgress: progress,
    lastScanEnd: lastEnd,
    startScan,
    ai: { status: ai.status, progress: ai.progress },
    learnedFrom: feedback.decisions,
    sizes: sizes.sizes,
    sizesError: sizes.error,
    itemCount: items.length,
    itemsById,
    groups,
    cleanup,
    counts,
    error,
    command,
    decide,
    restore,
    makeAlbum,
    largeImage,
    videoStream,
    isDecided: (id: string) => decisions.has(id),
    undo,
    clearAll,
  };
}

export type Vault = ReturnType<typeof useVault>;
