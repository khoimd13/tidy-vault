/** All side panel state in one hook: the Google Photos tab, scan progress, items and decisions. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { heuristicClassifier, noSuggestions } from '../../ml/classifier';
import { createClipClassifier } from '../../ml/clipClassifier';
import { isContentToPanel, type PanelToContent } from '../../shared/messages';
import type { Decision, DecisionKind, PhotoItem, ScanState, Suggestion } from '../../shared/types';
import * as store from '../../store/db';
import { buildCleanupList } from '../../suggest/cleanupList';
import { buildSuggestions, groupSuggestions } from '../../suggest/suggestions';
import { findPhotosTabId, sendToTab } from '../lib/chromeApi';
import { useAnalysis } from './useAnalysis';

export interface ScanStatus {
  state: ScanState;
  seen: number;
}

const NOT_CONNECTED = 'Reload the Google Photos tab so Vault Tidy can connect to it.';

function mergeItems(prev: PhotoItem[], next: PhotoItem[]): PhotoItem[] {
  const byId = new Map(prev.map((i) => [i.id, i]));
  for (const i of next) byId.set(i.id, i);
  return [...byId.values()];
}

export function useVault() {
  const [tabId, setTabId] = useState<number | null>(null);
  const tabIdRef = useRef<number | null>(null);
  tabIdRef.current = tabId;
  /** Bumped when the Photos tab finishes loading, so we reconnect to its fresh content script. */
  const [tabLoads, setTabLoads] = useState(0);
  const [scan, setScan] = useState<ScanStatus>({ state: 'idle', seen: 0 });
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [error, setError] = useState<string | null>(null);

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
          setScan({ state: msg.reason === 'end' ? 'done' : 'cancelled', seen: msg.seen });
          break;
        case 'scan/error':
          setError(msg.message);
          break;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [addItems]);

  const command = useCallback(
    async (type: PanelToContent['type']) => {
      if (tabId === null) return;
      try {
        const res = await sendToTab(tabId, { type });
        setScan({ state: res.state, seen: res.seen });
        if (res.items) addItems(res.items);
        setError(null);
      } catch {
        setError(NOT_CONNECTED);
      }
    },
    [tabId, addItems],
  );

  // Connect to the tab: learn its scan state and catch up on items found while the panel was closed.
  useEffect(() => {
    if (tabId === null) {
      setError(null);
      return;
    }
    void command('ping');
  }, [tabId, tabLoads, command]);

  const ai = useAnalysis(items);

  // With the AI: only analysed photos are suggested (they appear as analysis runs), so the cruder
  // shape rule never shows wrong suggestions that then disappear. Without it: shape rule only.
  const classifier = useMemo(() => {
    if (ai.status.state === 'unavailable') return heuristicClassifier;
    if (!ai.bank) return noSuggestions;
    return createClipClassifier(ai.bank, ai.embeddings, noSuggestions);
  }, [ai.status.state, ai.bank, ai.embeddings]);

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

  const clearAll = useCallback(async () => {
    await store.clearAll();
    setItems([]);
    setDecisions(new Map());
    ai.reset();
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

  return {
    onPhotos: tabId !== null,
    scan,
    ai: { status: ai.status, progress: ai.progress },
    itemCount: items.length,
    groups,
    cleanup,
    counts,
    error,
    command,
    decide,
    restore,
    undo,
    clearAll,
  };
}

export type Vault = ReturnType<typeof useVault>;
