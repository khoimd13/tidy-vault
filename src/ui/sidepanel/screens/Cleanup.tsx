import { useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import { toCsv } from '../../../suggest/cleanupList';
import { downloadText } from '../../lib/download';
import type { ToastApi } from '../components/Toast';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  toast: ToastApi;
  onBack: () => void;
}

export function Cleanup({ vault, toast, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const all = [...vault.cleanup.values()].flat();

  const copyLinks = async () => {
    await navigator.clipboard.writeText(all.map((e) => e.item.url).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main class="screen">
      <header class="row">
        <button class="link" onClick={onBack}>
          ← Back
        </button>
        <h2 tabIndex={-1}>Cleanup list</h2>
        <span class="muted">{all.length}</span>
      </header>

      {all.length === 0 ? (
        <p class="empty">Nothing here yet. Photos you confirm as clutter are listed here.</p>
      ) : (
        <>
          <p class="muted">
            Nothing has been changed in Google Photos. These are the photos you said you don't need.
          </p>
          <div class="actions">
            <button class="primary" onClick={() => void copyLinks()}>
              {copied ? 'Copied' : 'Copy links'}
            </button>
            <button onClick={() => downloadText('vault-tidy-cleanup.csv', toCsv(all), 'text/csv')}>
              Export CSV
            </button>
          </div>

          <details class="card">
            <summary>How to remove these in Google Photos</summary>
            <ol>
              <li>Open a photo with its ↗ link, or find it by date in Google Photos.</li>
              <li>Tick it, then Shift+click another to select everything in between.</li>
              <li>Click the trash icon. Google Photos keeps trashed items for 60 days.</li>
            </ol>
          </details>

          {[...vault.cleanup.entries()].map(([categoryId, entries]) => (
            <section key={categoryId} class="stack">
              <h3>
                {categoryById(categoryId)?.name ?? categoryId} ({entries.length})
              </h3>
              <ul class="list">
                {entries.map(({ item, decision }) => (
                  <li key={item.id} class="row">
                    <img src={item.thumbUrl} alt="" loading="lazy" />
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.takenAt ?? 'Unknown date'} ↗
                    </a>
                    <button
                      class="link"
                      onClick={() => {
                        void vault.undo([item.id]);
                        toast.show('Removed from the list', () => void vault.restore([decision]));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
