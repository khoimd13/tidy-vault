import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import type { DecisionKind, PhotoItem, Suggestion } from '../../../shared/types';
import type { SuggestionGroup } from '../../../suggest/suggestions';
import { useI18n, type I18n } from '../../i18n';
import { LargePhoto } from '../components/LargePhoto';
import type { ToastApi } from '../components/Toast';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  toast: ToastApi;
  categoryId: string;
  group: SuggestionGroup | undefined;
  onBack: () => void;
}

type Mode =
  { name: 'grid' } | { name: 'swipe' } | { name: 'detail'; list: Suggestion[]; index: number };

const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

export function Review({ vault, toast, categoryId, group, onBack }: Props) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const suggestions = useMemo(() => group?.suggestions ?? [], [group]);
  const likely = suggestions.filter((s) => s.confidence === 'high');
  const unsure = suggestions.filter((s) => s.confidence !== 'high');
  const [mode, setMode] = useState<Mode>({ name: 'grid' });

  // High confidence starts selected; the person unticks anything to keep.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(likely.map((s) => s.item.id)),
  );

  const name = i18n.category(categoryId, categoryById(categoryId)?.name);
  const chosen = suggestions.filter((s) => selected.has(s.item.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const act = async (kind: DecisionKind) => {
    if (chosen.length === 0) return;
    const ids = await vault.decide(chosen, kind);
    setSelected(new Set());
    toast.show(
      t(kind === 'clutter' ? 'toastAdded' : 'toastKept', { n: n(ids.length) }),
      () => void vault.undo(ids),
    );
  };

  const count = chosen.length;
  const selectAllOrNone = () =>
    setSelected(count > 0 ? new Set() : new Set(suggestions.map((s) => s.item.id)));

  // Grid keyboard shortcuts (the detail and swipe views handle their own keys).
  useEffect(() => {
    if (mode.name !== 'grid') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'y') void act('clutter');
      else if (key === 'k') void act('keep');
      else if (key === 'a') selectAllOrNone();
      else if (key === 'escape') onBack();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const openDetail = (list: Suggestion[], s: Suggestion) =>
    setMode({ name: 'detail', list, index: Math.max(0, list.indexOf(s)) });

  if (mode.name === 'swipe') {
    return (
      <Swipe
        vault={vault}
        i18n={i18n}
        title={name}
        items={unsure.filter((s) => !vault.isDecided(s.item.id))}
        onClose={() => setMode({ name: 'grid' })}
      />
    );
  }

  return (
    <main class="screen">
      <header class="row">
        <button class="link" onClick={onBack}>
          {t('back')}
        </button>
        <h2 tabIndex={-1}>{name}</h2>
        <span class="muted">{t('selected', { n: n(count) })}</span>
      </header>

      {suggestions.length === 0 ? (
        <p class="empty">{t('nothingLeft')}</p>
      ) : (
        <>
          <div class="actions sticky">
            <button class="primary" disabled={count === 0} onClick={() => void act('clutter')}>
              {count > 0 ? t('addN', { n: n(count) }) : t('add')}
            </button>
            <button disabled={count === 0} onClick={() => void act('keep')}>
              {t('keep')}
            </button>
            <button class="link" onClick={selectAllOrNone}>
              {count > 0 ? t('clearSelection') : t('selectAll')}
            </button>
            <span class="muted shortcuts" aria-hidden="true">
              {t('shortcuts')}
            </span>
          </div>

          {categoryId === 'duplicates' && (
            <Bursts
              i18n={i18n}
              suggestions={suggestions}
              keptById={vault.itemsById}
              name={name}
              selected={selected}
              onToggle={toggle}
              onOpen={(s) => openDetail(suggestions, s)}
            />
          )}
          {categoryId !== 'duplicates' && likely.length > 0 && (
            <Section
              i18n={i18n}
              title={t('likely', { n: n(likely.length) })}
              hint={
                likely.every((s) => selected.has(s.item.id))
                  ? t('likelyHintAll')
                  : t('likelyHintSome')
              }
              items={likely}
              name={name}
              selected={selected}
              onToggle={toggle}
              onOpen={(s) => openDetail(likely, s)}
            />
          )}
          {categoryId !== 'duplicates' && unsure.length > 0 && (
            <Section
              i18n={i18n}
              title={t('notSure', { n: n(unsure.length) })}
              hint={t('notSureHint')}
              action={
                <button class="soft" onClick={() => setMode({ name: 'swipe' })}>
                  {t('oneByOne')}
                </button>
              }
              items={unsure}
              name={name}
              selected={selected}
              onToggle={toggle}
              onOpen={(s) => openDetail(unsure, s)}
            />
          )}
        </>
      )}

      {mode.name === 'detail' && (
        <Detail
          i18n={i18n}
          vault={vault}
          list={mode.list}
          index={mode.index}
          name={name}
          selected={selected}
          onToggle={toggle}
          onMove={(index) => setMode({ ...mode, index })}
          onClose={() => setMode({ name: 'grid' })}
        />
      )}
    </main>
  );
}

interface SectionProps {
  i18n: I18n;
  title: string;
  hint: string;
  action?: ComponentChildren;
  items: Suggestion[];
  name: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (s: Suggestion) => void;
}

function Section({
  i18n,
  title,
  hint,
  action,
  items,
  name,
  selected,
  onToggle,
  onOpen,
}: SectionProps) {
  return (
    <section class="stack">
      <div class="row">
        <h3>{title}</h3>
        {action}
      </div>
      <p class="muted">{hint}</p>
      <ul class="grid">
        {items.map((s) => (
          <SuggestionTile
            key={s.item.id}
            i18n={i18n}
            s={s}
            name={name}
            on={selected.has(s.item.id)}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

interface TileProps {
  i18n: I18n;
  s: Suggestion;
  name: string;
  on: boolean;
  onToggle: (id: string) => void;
  onOpen: (s: Suggestion) => void;
}

function SuggestionTile({ i18n, s, name, on, onToggle, onOpen }: TileProps) {
  const { t } = i18n;
  const date = s.item.takenAt ?? t('unknownDate');
  const also = (s.alsoIn ?? []).map((id) => i18n.category(id, categoryById(id)?.name));
  return (
    <li class="cell">
      <div class="tile-wrap">
        <button
          class={`tile${on ? ' selected' : ''}`}
          aria-pressed={on}
          title={[...s.reasons.map(i18n.reason), ...also.map((a) => t('alsoIn', { list: a }))].join(
            ' · ',
          )}
          onClick={() => onToggle(s.item.id)}
        >
          <Thumb item={s.item} alt={`${name}, ${date}`} />
          {s.item.kind === 'video' && (
            <span class="vbadge" aria-hidden="true">
              ▶ {typeof s.item.durationSec === 'number' ? formatDuration(s.item.durationSec) : ''}
            </span>
          )}
          <span class={`chip ${s.confidence}`}>{t(s.confidence)}</span>
          {on && (
            <span class="check" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
        <button
          class="zoom"
          aria-label={`${t('viewLarger')}: ${date}`}
          title={t('viewLarger')}
          onClick={() => onOpen(s)}
        >
          ⤢
        </button>
      </div>
      <TileCaption i18n={i18n} item={s.item} />
      {also.length > 0 && <span class="also">{t('alsoIn', { list: also.join(', ') })}</span>}
    </li>
  );
}

function TileCaption({ i18n, item }: { i18n: I18n; item: PhotoItem }) {
  const date = item.takenAt ?? i18n.t('unknownDate');
  return (
    <div class="caption">
      <span class="muted">{item.takenAt?.slice(0, 7) ?? '—'}</span>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${i18n.t('openInPhotos')}, ${date}`}
        title={i18n.t('openInPhotos')}
      >
        ↗
      </a>
    </div>
  );
}

interface BurstsProps {
  i18n: I18n;
  suggestions: Suggestion[];
  keptById: ReadonlyMap<string, PhotoItem>;
  name: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (s: Suggestion) => void;
}

/** Near-duplicates, one row per burst: the photo that stays first, then the ones that would go. */
function Bursts({ i18n, suggestions, keptById, name, selected, onToggle, onOpen }: BurstsProps) {
  const { t } = i18n;
  const bursts = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const key = s.relatedId ?? s.item.id;
    bursts.set(key, [...(bursts.get(key) ?? []), s]);
  }
  return (
    <section class="stack">
      <p class="muted">{t('burstHint')}</p>
      {[...bursts].map(([keptId, members]) => {
        const kept = keptById.get(keptId);
        return (
          <ul key={keptId} class="grid burst">
            {kept && (
              <li class="cell">
                <div class="tile kept" title={t('keptTitle')}>
                  <Thumb
                    item={kept}
                    alt={t('keptAlt', { date: kept.takenAt ?? t('unknownDate') })}
                  />
                  <span class="chip kept-chip">{t('kept')}</span>
                </div>
                <TileCaption i18n={i18n} item={kept} />
              </li>
            )}
            {members.map((s) => (
              <SuggestionTile
                key={s.item.id}
                i18n={i18n}
                s={s}
                name={name}
                on={selected.has(s.item.id)}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
        );
      })}
    </section>
  );
}

interface DetailProps {
  i18n: I18n;
  vault: Vault;
  list: Suggestion[];
  index: number;
  name: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onMove: (index: number) => void;
  onClose: () => void;
}

/** Large view of one photo, with its reasons; ← → to move, Space to select, Esc to close. */
function Detail({
  i18n,
  vault,
  list,
  index,
  name,
  selected,
  onToggle,
  onMove,
  onClose,
}: DetailProps) {
  const { t } = i18n;
  const s = list[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < list.length - 1) onMove(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onMove(index - 1);
      else if (e.key === ' ' && s) onToggle(s.item.id);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!s) return null;
  const on = selected.has(s.item.id);
  const date = s.item.takenAt ?? t('unknownDate');
  const also = (s.alsoIn ?? []).map((id) => i18n.category(id, categoryById(id)?.name));
  return (
    <div class="detail" role="dialog" aria-modal="true" aria-label={`${name}, ${date}`}>
      <div class="detail-top row">
        <span class="muted">{t('ofN', { a: index + 1, b: list.length })}</span>
        <button ref={closeRef} class="link" onClick={onClose} aria-label={t('close')}>
          ✕
        </button>
      </div>
      <LargePhoto item={s.item} alt={`${name}, ${date}`} loadLarge={vault.largeImage} />
      <div class="detail-info stack">
        <div class="row">
          <strong>{date}</strong>
          <span class={`chip ${s.confidence}`}>{t(s.confidence)}</span>
        </div>
        <ul class="reasons">
          {s.reasons.map((r) => (
            <li key={r}>{i18n.reason(r)}</li>
          ))}
        </ul>
        {also.length > 0 && <span class="also">{t('alsoIn', { list: also.join(', ') })}</span>}
      </div>
      <div class="detail-actions">
        <button disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={t('previous')}>
          ‹
        </button>
        <button class={on ? 'primary' : 'soft'} onClick={() => onToggle(s.item.id)}>
          {on ? `✓ ${t('isSelected')}` : t('select')}
        </button>
        <a class="button-like" href={s.item.url} target="_blank" rel="noreferrer">
          {t('openInPhotos')} ↗
        </a>
        <button
          disabled={index >= list.length - 1}
          onClick={() => onMove(index + 1)}
          aria-label={t('next')}
        >
          ›
        </button>
      </div>
    </div>
  );
}

interface SwipeProps {
  vault: Vault;
  i18n: I18n;
  title: string;
  items: Suggestion[];
  onClose: () => void;
}

/** One photo at a time: → or drag right = clutter, ← or drag left = keep, ↓ = skip, Z = undo. */
function Swipe({ vault, i18n, title, items, onClose }: SwipeProps) {
  const { t } = i18n;
  // Freeze the list when entering, so deciding doesn't reshuffle what's left.
  const [queue] = useState(items);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ index: number; id: string | null }[]>([]);
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  const s = queue[index];

  const decide = async (kind: DecisionKind | 'skip') => {
    if (!s) return;
    if (kind !== 'skip') await vault.decide([s], kind);
    setHistory((h) => [...h, { index, id: kind === 'skip' ? null : s.item.id }]);
    setIndex((i) => i + 1);
    setDrag(null);
  };

  const undo = async () => {
    const last = history.at(-1);
    if (!last) return;
    if (last.id) await vault.undo([last.id]);
    setHistory((h) => h.slice(0, -1));
    setIndex(last.index);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e)) return;
      if (e.key === 'ArrowRight') void decide('clutter');
      else if (e.key === 'ArrowLeft') void decide('keep');
      else if (e.key === 'ArrowDown') void decide('skip');
      else if (e.key.toLowerCase() === 'z') void undo();
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dx = drag?.dx ?? 0;
  const leaning = dx > 40 ? 'clutter' : dx < -40 ? 'keep' : null;

  return (
    <main class="screen swipe">
      <header class="row">
        <button class="link" onClick={onClose}>
          {t('back')}
        </button>
        <h2 tabIndex={-1}>{title}</h2>
        <span class="muted">{s ? t('ofN', { a: index + 1, b: queue.length }) : ''}</span>
      </header>

      {!s ? (
        <div class="stack swipe-done">
          <p class="empty">{t('swipeDone')}</p>
          <button class="primary" onClick={onClose}>
            {t('backToGrid')}
          </button>
          {history.length > 0 && (
            <button class="link" onClick={() => void undo()}>
              {t('undo')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            class={`swipe-card${leaning ? ` lean-${leaning}` : ''}`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDrag({ startX: e.clientX, dx: 0 });
            }}
            onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.startX })}
            onPointerUp={() => {
              if (dx > 90) void decide('clutter');
              else if (dx < -90) void decide('keep');
              else setDrag(null);
            }}
            onPointerCancel={() => setDrag(null)}
          >
            <LargePhoto
              item={s.item}
              alt={`${title}, ${s.item.takenAt ?? t('unknownDate')}`}
              loadLarge={vault.largeImage}
            />
            {leaning && (
              <span class={`swipe-stamp ${leaning}`}>
                {leaning === 'clutter' ? t('swipeClutter') : t('swipeKeep')}
              </span>
            )}
          </div>
          <div class="stack">
            <div class="row">
              <strong>{s.item.takenAt ?? t('unknownDate')}</strong>
              <span class={`chip ${s.confidence}`}>{t(s.confidence)}</span>
            </div>
            <ul class="reasons">
              {s.reasons.map((r) => (
                <li key={r}>{i18n.reason(r)}</li>
              ))}
            </ul>
          </div>
          <div class="swipe-actions">
            <button class="keep-btn" onClick={() => void decide('keep')}>
              ← {t('swipeKeep')}
            </button>
            <button onClick={() => void decide('skip')}>{t('swipeSkip')}</button>
            <button class="primary" onClick={() => void decide('clutter')}>
              {t('swipeClutter')} →
            </button>
          </div>
          <p class="muted shortcuts">{t('swipeHelp')}</p>
        </>
      )}
    </main>
  );
}

/** 3 → "0:03", 754 → "12:34". */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
