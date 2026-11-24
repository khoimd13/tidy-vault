import { useEffect, useState } from 'preact/hooks';
import { categoryById } from '../../../shared/categories';
import { estimateBytes, formatApproxSize } from '../../../suggest/space';
import type { SuggestionGroup } from '../../../suggest/suggestions';
import { useI18n, type I18n } from '../../i18n';
import {
  clearBadge,
  getFlag,
  openGooglePhotos,
  savePendingCount,
  setFlag,
} from '../../lib/chromeApi';
import { AiSparkle } from '../components/AiSparkle';
import { Thumb } from '../components/Thumb';
import type { Vault } from '../useVault';

interface Props {
  vault: Vault;
  onReview: (categoryId: string) => void;
  onCleanup: () => void;
}

const REMINDER = 'reminder';

function monthOf(iso: string, locale: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t)
    ? iso
    : new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(t));
}

function span(i18n: I18n, s: { from: string; to: string }): string {
  const from = monthOf(s.from, i18n.locale);
  const to = monthOf(s.to, i18n.locale);
  return from === to ? i18n.t('mostlyOne', { m: from }) : i18n.t('mostly', { from, to });
}

export function Home({ vault, onReview, onCleanup }: Props) {
  const i18n = useI18n();
  const { t, n } = i18n;
  // A photo can be in several groups; count it once.
  const all = vault.groups.flatMap((g) => g.suggestions);
  const total = new Set(all.map((s) => s.item.id)).size;
  const bytes = estimateBytes(all);
  const hasData = vault.itemCount > 0 || vault.counts.clutter > 0 || vault.counts.kept > 0;

  // Keep the reminder badge's count current, and clear the badge now the panel is open.
  useEffect(() => {
    void savePendingCount(total);
  }, [total]);
  useEffect(() => {
    void clearBadge();
  }, []);

  return (
    <main class="screen">
      <header class="row">
        <h2 tabIndex={-1}>{t('suggestions')}</h2>
      </header>

      {hasData && (
        <section class="summary row">
          <div class="stack">
            <strong>{t('toReview', { n: n(total) })}</strong>
            {bytes > 0 && (
              <span class="space" title={t('estimateNote')}>
                {t('couldFree', { size: formatApproxSize(bytes, i18n.locale) })}
              </span>
            )}
            <span class="muted">
              {t('listAndKept', { c: n(vault.counts.clutter), k: n(vault.counts.kept) })}
            </span>
          </div>
          {vault.counts.clutter > 0 && <button onClick={onCleanup}>{t('cleanupList')}</button>}
        </section>
      )}

      <ScanCard vault={vault} i18n={i18n} />
      <AiLine vault={vault} i18n={i18n} />
      {vault.error && (
        <p class="notice" role="alert">
          {vault.error.code === 'notConnected'
            ? `${t('notConnected')} (${vault.error.detail})`
            : vault.error.detail}
        </p>
      )}

      {vault.groups.map((g, i) => (
        <GroupCard
          key={g.categoryId}
          i18n={i18n}
          group={g}
          primary={i === 0}
          onReview={() => onReview(g.categoryId)}
        />
      ))}
      {vault.groups.length === 0 && vault.scan.state !== 'running' && aiFinished(vault) && (
        <p class="empty">{t('allCaught')}</p>
      )}

      <footer class="footer muted">
        <span>{t('footer')}</span>
        {hasData && (
          <button
            class="link"
            onClick={() => {
              if (confirm(t('clearConfirm'))) void vault.clearAll();
            }}
          >
            {t('clearData')}
          </button>
        )}
      </footer>
      <Settings i18n={i18n} />
    </main>
  );
}

function Settings({ i18n }: { i18n: I18n }) {
  const { t, lang, setLang } = i18n;
  const [reminder, setReminder] = useState(false);
  useEffect(() => {
    void getFlag(REMINDER).then(setReminder);
  }, []);
  return (
    <section class="settings muted">
      <label title={t('reminderHint')}>
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setReminder(on);
            void setFlag(REMINDER, on);
          }}
        />
        {t('reminder')}
      </label>
      <div class="row" style={{ justifyContent: 'flex-start' }}>
        <button
          class="link"
          lang={lang === 'vi' ? 'en' : 'vi'}
          onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
        >
          {lang === 'vi' ? 'English' : 'Tiếng Việt'}
        </button>
      </div>
    </section>
  );
}

function ScanCard({ vault, i18n }: { vault: Vault; i18n: I18n }) {
  const { t, n } = i18n;
  if (!vault.onPhotos) {
    return (
      <section class="card">
        <p>{t('openPhotosPrompt')}</p>
        <button class="primary" onClick={() => void openGooglePhotos()}>
          {t('openPhotos')}
        </button>
      </section>
    );
  }

  const { state, seen } = vault.scan;
  const running = state === 'running' || state === 'paused';
  const looked = t('lookedAt', { n: n(seen > 0 ? seen : vault.itemCount) });

  if (running) {
    return (
      <section class="card">
        <div class="row">
          <strong>{state === 'paused' ? t('paused') : t('finding')}</strong>
          <span class="muted">{looked}</span>
        </div>
        {state === 'running' ? (
          <progress aria-label={t('finding')} />
        ) : (
          <progress aria-label={t('paused')} value={0} max={1} />
        )}
        <div class="actions">
          {state === 'running' ? (
            <button onClick={() => void vault.command('scan/pause')}>{t('pause')}</button>
          ) : (
            <button class="primary" onClick={() => void vault.command('scan/resume')}>
              {t('resume')}
            </button>
          )}
          <button onClick={() => void vault.command('scan/cancel')}>{t('stop')}</button>
        </div>
        <p class="hint muted">{t('reviewWhileRuns')}</p>
      </section>
    );
  }

  // After a scan, reviewing is the main job, so scanning again becomes a quiet secondary action.
  if (state === 'done' || state === 'cancelled' || vault.itemCount > 0) {
    return (
      <section class="card row">
        <span class="muted">
          {looked}
          {state === 'cancelled' && t('stopped')}
        </span>
        <button onClick={() => void vault.command('scan/start')}>{t('scanAgain')}</button>
      </section>
    );
  }

  return (
    <section class="card">
      <p>{t('scanIntro')}</p>
      <button class="primary" onClick={() => void vault.command('scan/start')}>
        {t('findSuggestions')}
      </button>
    </section>
  );
}

interface GroupCardProps {
  i18n: I18n;
  group: SuggestionGroup;
  /** Only the top group gets the filled button, so the screen isn't a wall of lavender. */
  primary: boolean;
  onReview: () => void;
}

function GroupCard({ i18n, group, primary, onReview }: GroupCardProps) {
  const { t, n } = i18n;
  const name = i18n.category(group.categoryId, categoryById(group.categoryId)?.name);
  const reason = group.topReason ? i18n.reason(group.topReason) : null;
  const bytes = estimateBytes(group.suggestions);
  return (
    <section class="card">
      <div class="row">
        <h3>
          {n(group.suggestions.length)} {name.toLowerCase()}
        </h3>
        {bytes > 0 && (
          <span class="space" title={t('estimateNote')}>
            {formatApproxSize(bytes, i18n.locale)}
          </span>
        )}
      </div>
      {group.span && <p class="muted">{span(i18n, group.span)}</p>}
      <div class="strip" aria-hidden="true">
        {group.samples.map((s) => (
          <Thumb key={s.item.id} item={s.item} />
        ))}
      </div>
      {reason && (
        <p class="muted">{t('why', { r: reason.charAt(0).toLowerCase() + reason.slice(1) })}</p>
      )}
      <div class="chips">
        {group.counts.high > 0 && (
          <span class="chip high">
            {t('high')} {n(group.counts.high)}
          </span>
        )}
        {group.counts.medium > 0 && (
          <span class="chip medium">
            {t('medium')} {n(group.counts.medium)}
          </span>
        )}
        {group.counts.low > 0 && (
          <span class="chip low">
            {t('low')} {n(group.counts.low)}
          </span>
        )}
      </div>
      <button class={primary ? 'primary wide' : 'soft wide'} onClick={onReview}>
        {t('review')}
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

/** The AI status: sparkle loader while waking up or analysing, a quiet line when done. */
function AiLine({ vault, i18n }: { vault: Vault; i18n: I18n }) {
  const { t, n } = i18n;
  const { status, progress } = vault.ai;
  // The page reader found photos but none of their thumbnails: say so plainly instead of
  // looking like there is nothing to clean up.
  if (progress.total === 0 && progress.noThumbnail > 0) {
    return (
      <p class="notice" role="alert">
        {t('noThumbs', { n: n(progress.noThumbnail) })}
      </p>
    );
  }
  if (status.state === 'ready' && progress.done === 0 && progress.failed > 0) {
    return (
      <p class="notice" role="alert">
        {t('noneLoaded', { n: n(progress.failed) })}
      </p>
    );
  }
  if (status.state === 'unavailable') {
    return (
      <p class="notice" title={status.message}>
        {t('aiUnavailable')}
      </p>
    );
  }
  if (status.state === 'loading') {
    // Saved results already show; only mention loading when there's new work waiting for it.
    return progress.done < progress.total ? <AiSparkle label={t('aiWaking')} /> : null;
  }
  const left = progress.total - progress.done - progress.failed;
  if (left > 0) {
    return (
      <AiSparkle
        label={t('aiAnalysing')}
        detail={t('ofN', { a: n(progress.done), b: n(progress.total) })}
        progress={progress.done / Math.max(1, progress.total)}
      />
    );
  }
  if (progress.done === 0) return null;
  return (
    <p class="ai muted">
      {t('aiDone', { n: n(progress.done) })}
      {progress.failed > 0 && t('aiFailed', { n: n(progress.failed) })}.
      {vault.learnedFrom > 0 && t('tuned', { n: n(vault.learnedFrom) })}
    </p>
  );
}
