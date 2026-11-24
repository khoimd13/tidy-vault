import { useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import { toCsv } from '../../../suggest/cleanupList';
import { useI18n } from '../../i18n';
import { downloadText } from '../../lib/download';
import type { ToastApi } from '../components/Toast';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  toast: ToastApi;
  onBack: () => void;
}

/** Today's local date as yyyy-mm-dd, for the album name. */
function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type AlbumState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; name: string; added: number; verifiedCount: number | null }
  | { phase: 'failed'; error: string };

export function Cleanup({ vault, toast, onBack }: Props) {
  const { t, n, category } = useI18n();
  const [copied, setCopied] = useState(false);
  const [album, setAlbum] = useState<AlbumState>({ phase: 'idle' });
  const all = [...vault.cleanup.values()].flat();

  const makeAlbum = async () => {
    const name = t('albumName', { date: localDate() });
    const ok = confirm(t('albumConfirm', { n: n(all.length), name }));
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
          {t('back')}
        </button>
        <h2 tabIndex={-1}>{t('cleanupList')}</h2>
        <span class="muted">{all.length}</span>
      </header>

      {all.length === 0 ? (
        <p class="empty">{t('cleanupEmpty')}</p>
      ) : (
        <>
          <p class="muted">{t('cleanupIntro')}</p>
          <div class="actions">
            <button class="primary" onClick={() => void copyLinks()}>
              {copied ? t('copied') : t('copyLinks')}
            </button>
            <button onClick={() => downloadText('vault-tidy-cleanup.csv', toCsv(all), 'text/csv')}>
              {t('exportCsv')}
            </button>
          </div>

          <section class="card">
            <strong>{t('fastest')}</strong>
            <p class="muted">{t('fastestBody')}</p>
            {album.phase === 'idle' && (
              <button onClick={() => void makeAlbum()} disabled={!vault.onPhotos}>
                {t('albumButton', { n: n(all.length) })}
              </button>
            )}
            {album.phase === 'working' && <p role="status">{t('albumWorking')}</p>}
            {album.phase === 'done' && (
              <div role="status" class="stack">
                <p>
                  {t('albumDone', { n: n(album.added), name: album.name })}
                  {album.verifiedCount !== null &&
                    album.verifiedCount !== album.added &&
                    t('albumGoogleCount', { n: n(album.verifiedCount) })}
                </p>
                <ol class="muted">
                  <li>{t('albumStep1')}</li>
                  <li>{t('albumStep2')}</li>
                  <li>{t('albumStep3')}</li>
                </ol>
                <a href="https://photos.google.com/albums" target="_blank" rel="noreferrer">
                  {t('openAlbums')}
                </a>
              </div>
            )}
            {album.phase === 'failed' && (
              <p class="notice" role="alert">
                {t('albumFailed', { error: album.error })}{' '}
                <button class="link" onClick={() => setAlbum({ phase: 'idle' })}>
                  {t('tryAgain')}
                </button>
              </p>
            )}
            {!vault.onPhotos && album.phase === 'idle' && (
              <p class="muted">{t('openPhotosToUse')}</p>
            )}
          </section>

          <details class="card">
            <summary>{t('oneByOneRemove')}</summary>
            <ol>
              <li>{t('manualStep1')}</li>
              <li>{t('manualStep2')}</li>
              <li>{t('manualStep3')}</li>
            </ol>
          </details>

          {[...vault.cleanup.entries()].map(([categoryId, entries]) => (
            <section key={categoryId} class="stack">
              <h3>
                {category(categoryId, categoryById(categoryId)?.name)} ({n(entries.length)})
              </h3>
              <ul class="list">
                {entries.map(({ item, decision }) => (
                  <li key={item.id} class="row">
                    <Thumb item={item} />
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.takenAt ?? t('unknownDate')} ↗
                    </a>
                    <button
                      class="link"
                      onClick={() => {
                        void vault.undo([item.id]);
                        toast.show(t('removedFromList'), () => void vault.restore([decision]));
                      }}
                    >
                      {t('remove')}
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
