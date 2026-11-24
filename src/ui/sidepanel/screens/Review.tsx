import { useEffect, useMemo, useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import type { Confidence, DecisionKind, Suggestion } from '../../../shared/types';
import type { SuggestionGroup } from '../../../suggest/suggestions';
import type { ToastApi } from '../components/Toast';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

const LABEL: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' };

interface Props {
  vault: Vault;
  toast: ToastApi;
  categoryId: string;
  group: SuggestionGroup | undefined;
  onBack: () => void;
}

export function Review({ vault, toast, categoryId, group, onBack }: Props) {
  const suggestions = useMemo(() => group?.suggestions ?? [], [group]);
  const likely = suggestions.filter((s) => s.confidence === 'high');
  const unsure = suggestions.filter((s) => s.confidence !== 'high');

  // Gemini-style: High confidence starts selected; the person unticks anything to keep.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(likely.map((s) => s.item.id)),
  );

  const name = categoryById(categoryId)?.name ?? categoryId;
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
      kind === 'clutter'
        ? `${ids.length} added to your cleanup list`
        : `${ids.length} kept — won't be suggested again`,
      () => void vault.undo(ids),
    );
  };

  const n = chosen.length;
  const selectAllOrNone = () =>
    setSelected(n > 0 ? new Set() : new Set(suggestions.map((s) => s.item.id)));

  // Keyboard shortcuts. Re-registered each render so handlers see the current selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  return (
    <main class="screen">
      <header class="row">
        <button class="link" onClick={onBack}>
          ← Back
        </button>
        <h2 tabIndex={-1}>{name}</h2>
        <span class="muted">{n} selected</span>
      </header>

      {suggestions.length === 0 ? (
        <p class="empty">Nothing left to review here.</p>
      ) : (
        <>
          <div class="actions sticky">
            <button class="primary" disabled={n === 0} onClick={() => void act('clutter')}>
              {n > 0 ? `Add ${n} to cleanup list` : 'Add to cleanup list'}
            </button>
            <button disabled={n === 0} onClick={() => void act('keep')}>
              Keep
            </button>
            <button class="link" onClick={selectAllOrNone}>
              {n > 0 ? 'Clear selection' : 'Select all'}
            </button>
            <span class="muted shortcuts" aria-hidden="true">
              Y add · K keep · A all · Esc back
            </span>
          </div>

          {likely.length > 0 && (
            <Section
              title={`Likely clutter (${likely.length})`}
              hint={
                likely.every((s) => selected.has(s.item.id))
                  ? 'Already selected. Tap any photo you want to keep to untick it.'
                  : 'Tap photos to select them, then add them to your cleanup list or keep them.'
              }
              items={likely}
              name={name}
              selected={selected}
              onToggle={toggle}
            />
          )}
          {unsure.length > 0 && (
            <Section
              title={`Not sure (${unsure.length})`}
              hint="Tap the ones that are clutter."
              items={unsure}
              name={name}
              selected={selected}
              onToggle={toggle}
            />
          )}
        </>
      )}
    </main>
  );
}

interface SectionProps {
  title: string;
  hint: string;
  items: Suggestion[];
  name: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function Section({ title, hint, items, name, selected, onToggle }: SectionProps) {
  return (
    <section class="stack">
      <h3>{title}</h3>
      <p class="muted">{hint}</p>
      <ul class="grid">
        {items.map((s) => {
          const on = selected.has(s.item.id);
          const date = s.item.takenAt ?? 'Unknown date';
          return (
            <li key={s.item.id} class="cell">
              <button
                class={`tile${on ? ' selected' : ''}`}
                aria-pressed={on}
                title={s.reasons.join(' · ')}
                onClick={() => onToggle(s.item.id)}
              >
                <Thumb item={s.item} alt={`${name}, ${date}`} />
                <span class={`chip ${s.confidence}`}>{LABEL[s.confidence]}</span>
                {on && (
                  <span class="check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
              <div class="caption">
                <span class="muted">{s.item.takenAt?.slice(0, 7) ?? '—'}</span>
                <a
                  href={s.item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open in Google Photos, ${date}`}
                  title="Open in Google Photos"
                >
                  ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
