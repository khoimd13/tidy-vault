import { useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import { toCsv } from '../../../suggest/cleanupList';
import { downloadText } from '../../lib/download';
import type { ToastApi } from '../components/Toast';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  toast: ToastApi;
  onBack: () => void;
}

/** e.g. "Vault Tidy – to remove 2026-11-25" */
function albumName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `Vault Tidy – to remove ${local}`;
}

type AlbumState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; name: string; added: number; verifiedCount: number | null }
  | { phase: 'failed'; error: string };

export function Cleanup({ vault, toast, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [album, setAlbum] = useState<AlbumState>({ phase: 'idle' });
  const all = [...vault.cleanup.values()].flat();

  const makeAlbum = async () => {
    const name = albumName();
    const ok = confirm(
      `Add ${all.length} photos to a new private album called "${name}" in Google Photos?

` + 'Nothing is deleted or changed. Removing the album later keeps all its photos.',
    );
    if (!ok) return;
    setAlbum({ phase: 'working' });
    const result = await vault.makeAlbum(
      name,
      all.map((e) => e.item.id),
    );
    setAlbum(result.ok ? { phase: 'done', ...result } : { phase: 'failed', error: result.error });
  };

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

          <section class="card">
            <strong>Fastest way to remove them</strong>
            <p class="muted">
              Put them all in one new private album, then delete them from that album in Google
              Photos with select all. Vault Tidy itself never deletes anything.
            </p>
            {album.phase === 'idle' && (
              <button onClick={() => void makeAlbum()} disabled={!vault.onPhotos}>
                Put {all.length} in a new album (beta)
              </button>
            )}
            {album.phase === 'working' && (
              <p role="status">Adding photos to the album… keep the Google Photos tab open.</p>
            )}
            {album.phase === 'done' && (
              <div role="status" class="stack">
                <p>
                  Added {album.added.toLocaleString()} photos to “{album.name}”
                  {album.verifiedCount !== null &&
                    album.verifiedCount !== album.added &&
                    ` (Google reports ${album.verifiedCount})`}
                  .
                </p>
                <ol class="muted">
                  <li>Open the album in Google Photos.</li>
                  <li>Select all (tick one photo, then Shift+click the last).</li>
                  <li>Choose “Move to trash”. Trashed items stay recoverable for 60 days.</li>
                </ol>
                <a href="https://photos.google.com/albums" target="_blank" rel="noreferrer">
                  Open your albums in Google Photos ↗
                </a>
              </div>
            )}
            {album.phase === 'failed' && (
              <p class="notice" role="alert">
                Couldn't create the album ({album.error}). Nothing was deleted. You can still use
                the links or the CSV.{' '}
                <button class="link" onClick={() => setAlbum({ phase: 'idle' })}>
                  Try again
                </button>
              </p>
            )}
            {!vault.onPhotos && album.phase === 'idle' && (
              <p class="muted">Open Google Photos in this window to use this.</p>
            )}
          </section>

          <details class="card">
            <summary>Or remove them one by one</summary>
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
                    <Thumb item={item} />
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
