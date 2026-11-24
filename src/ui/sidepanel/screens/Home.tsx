import { categoryById } from '../../../shared/categories';
import type { SuggestionGroup } from '../../../suggest/suggestions';
import { openGooglePhotos } from '../../lib/chromeApi';
import { formatSpan } from '../../lib/format';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  onReview: (categoryId: string) => void;
  onCleanup: () => void;
}

export function Home({ vault, onReview, onCleanup }: Props) {
  // A photo can be in several groups; count it once.
  const total = new Set(vault.groups.flatMap((g) => g.suggestions.map((s) => s.item.id))).size;
  const hasData = vault.itemCount > 0 || vault.counts.clutter > 0 || vault.counts.kept > 0;

  return (
    <main class="screen">
      <header class="row">
        <h2 tabIndex={-1}>Suggestions</h2>
      </header>

      {hasData && (
        <section class="summary row">
          <div class="stack">
            <strong>{total.toLocaleString()} to review</strong>
            <span class="muted">
              {vault.counts.clutter.toLocaleString()} on your cleanup list ·{' '}
              {vault.counts.kept.toLocaleString()} kept
            </span>
          </div>
          {vault.counts.clutter > 0 && <button onClick={onCleanup}>Cleanup list</button>}
        </section>
      )}

      <ScanCard vault={vault} />
      <AiLine vault={vault} />
      {vault.error && (
        <p class="notice" role="alert">
          {vault.error}
        </p>
      )}

      {vault.groups.map((g, i) => (
        <GroupCard
          key={g.categoryId}
          group={g}
          primary={i === 0}
          onReview={() => onReview(g.categoryId)}
        />
      ))}
      {vault.groups.length === 0 && vault.scan.state !== 'running' && aiFinished(vault) && (
        <p class="empty">All caught up. New suggestions show up after your next scan.</p>
      )}

      <footer class="footer muted">
        <span>Analysed on this computer. Nothing is deleted.</span>
        {hasData && (
          <button
            class="link"
            onClick={() => {
              if (
                confirm('Clear all Vault Tidy data on this computer? Your photos are not affected.')
              )
                void vault.clearAll();
            }}
          >
            Clear local data
          </button>
        )}
      </footer>
    </main>
  );
}

function ScanCard({ vault }: { vault: Vault }) {
  if (!vault.onPhotos) {
    return (
      <section class="card">
        <p>Open Google Photos in this window to find suggestions.</p>
        <button class="primary" onClick={() => void openGooglePhotos()}>
          Open Google Photos
        </button>
      </section>
    );
  }

  const { state, seen } = vault.scan;
  const running = state === 'running' || state === 'paused';
  const looked = `Looked at ${seen.toLocaleString()} photos`;

  if (running) {
    return (
      <section class="card">
        <div class="row">
          <strong>{state === 'paused' ? 'Paused' : 'Finding suggestions…'}</strong>
          <span class="muted">{looked}</span>
        </div>
        {state === 'running' ? (
          <progress aria-label="Scan progress" />
        ) : (
          <progress aria-label="Scan paused" value={0} max={1} />
        )}
        <div class="actions">
          {state === 'running' ? (
            <button onClick={() => void vault.command('scan/pause')}>Pause</button>
          ) : (
            <button class="primary" onClick={() => void vault.command('scan/resume')}>
              Resume
            </button>
          )}
          <button onClick={() => void vault.command('scan/cancel')}>Stop</button>
        </div>
        <p class="hint muted">You can start reviewing while this runs.</p>
      </section>
    );
  }

  // After a scan, reviewing is the main job, so scanning again becomes a quiet secondary action.
  if (state === 'done' || state === 'cancelled' || vault.itemCount > 0) {
    return (
      <section class="card row">
        <span class="muted">
          {seen > 0 ? looked : `${vault.itemCount.toLocaleString()} photos looked at`}
          {state === 'cancelled' && ' (stopped)'}
        </span>
        <button onClick={() => void vault.command('scan/start')}>Scan again</button>
      </section>
    );
  }

  return (
    <section class="card">
      <p>
        Vault Tidy scrolls through what Google Photos is showing (your library, a search, or an
        album) and suggests photos you might not need.
      </p>
      <button class="primary" onClick={() => void vault.command('scan/start')}>
        Find suggestions
      </button>
    </section>
  );
}

interface GroupCardProps {
  group: SuggestionGroup;
  /** Only the top group gets the filled button, so the screen isn't a wall of lavender. */
  primary: boolean;
  onReview: () => void;
}

function GroupCard({ group, primary, onReview }: GroupCardProps) {
  const name = categoryById(group.categoryId)?.name ?? group.categoryId;
  return (
    <section class="card">
      <h3>
        {group.suggestions.length.toLocaleString()} {name.toLowerCase()}
      </h3>
      {group.span && <p class="muted">{formatSpan(group.span)}</p>}
      <div class="strip" aria-hidden="true">
        {group.samples.map((s) => (
          <Thumb key={s.item.id} item={s.item} />
        ))}
      </div>
      {group.topReason && <p class="muted">Why: {group.topReason.toLowerCase()}</p>}
      <div class="chips">
        {group.counts.high > 0 && <span class="chip high">High {group.counts.high}</span>}
        {group.counts.medium > 0 && <span class="chip medium">Medium {group.counts.medium}</span>}
        {group.counts.low > 0 && <span class="chip low">Low {group.counts.low}</span>}
      </div>
      <button class={primary ? 'primary wide' : 'soft wide'} onClick={onReview}>
        Review
      </button>
    </section>
  );
}

/** True when every photo that can be analysed has been (or the AI is off and rules apply). */
function aiFinished(vault: Vault): boolean {
  const { status, progress } = vault.ai;
  if (status.state === 'unavailable') return vault.itemCount > 0;
  return progress.done > 0 && progress.done + progress.failed >= progress.total;
}

/** One quiet line about the AI model: loading, analysing (with progress), done, or unavailable. */
function AiLine({ vault }: { vault: Vault }) {
  const { status, progress } = vault.ai;
  // The page reader found photos but none of their thumbnails: say so plainly instead of
  // looking like there is nothing to clean up.
  if (progress.total === 0 && progress.noThumbnail > 0) {
    return (
      <p class="notice" role="alert">
        Vault Tidy found {progress.noThumbnail.toLocaleString()} photos but couldn't read their
        thumbnails, so the AI can't look at them. Reload the Google Photos tab and scan again. If
        this keeps happening, Google Photos has changed its page and Vault Tidy needs an update.
      </p>
    );
  }
  if (status.state === 'ready' && progress.done === 0 && progress.failed > 0) {
    return (
      <p class="notice" role="alert">
        Couldn't load any of the {progress.failed.toLocaleString()} thumbnails, so the AI can't look
        at them. Check that you're signed in to Google Photos in this browser, then scan again.
      </p>
    );
  }
  if (status.state === 'unavailable') {
    return (
      <p class="notice" title={status.message}>
        The AI model isn't available, so only screenshot shapes are used. Other categories need it.
      </p>
    );
  }
  if (status.state === 'loading') {
    // Saved results already show; only mention loading when there's new work waiting for it.
    return progress.done < progress.total ? <p class="ai muted">Loading the AI model…</p> : null;
  }
  const left = progress.total - progress.done - progress.failed;
  if (left > 0) {
    return (
      <div class="ai">
        <div class="row">
          <span>Analysing photos with AI…</span>
          <span class="muted">
            {progress.done.toLocaleString()} of {progress.total.toLocaleString()}
          </span>
        </div>
        <progress
          aria-label="AI analysis progress"
          value={progress.done}
          max={Math.max(1, progress.total)}
        />
      </div>
    );
  }
  if (progress.done === 0) return null;
  return (
    <p class="ai muted">
      AI analysed {progress.done.toLocaleString()} photos on this computer
      {progress.failed > 0 && ` (${progress.failed.toLocaleString()} couldn't be loaded)`}.
      {vault.learnedFrom > 0 &&
        ` Suggestions are tuned by your ${vault.learnedFrom.toLocaleString()} choices.`}
    </p>
  );
}
