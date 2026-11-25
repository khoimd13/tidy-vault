/**
 * A big view of one photo: shows the stored thumbnail immediately, then swaps in a sharper
 * version fetched through the Google Photos tab when it arrives. Videos get a play button: the
 * video streams through the Google Photos tab and starts as soon as the first piece arrives.
 * If streaming fails, a short video is downloaded whole instead (with a progress bar).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhotoItem } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { formatDuration } from '../../lib/format';
import type { VideoLoad } from '../useVault';
import { Thumb } from './Thumb';

/** Longest video worth downloading whole when streaming fails. */
const DOWNLOAD_MAX_SECONDS = 180;

interface Props {
  item: PhotoItem;
  alt: string;
  loadLarge: (item: PhotoItem) => Promise<string | null>;
  /** Gets a video ready to play; omit to show videos as a still only. */
  loadVideo?: (
    item: PhotoItem,
    onProgress?: (fraction: number | null) => void,
    how?: 'stream' | 'download',
  ) => Promise<VideoLoad>;
}

type Playback =
  | { state: 'still' }
  | { state: 'loading'; fraction: number | null }
  | { state: 'playing'; url: string; streamed: boolean }
  | { state: 'failed'; tooBig: boolean };

/** Keeps a tap on the player from also starting a swipe or closing the view. */
const stop = (e: Event) => e.stopPropagation();

export function LargePhoto({ item, alt, loadLarge, loadVideo }: Props) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback>({ state: 'still' });
  /** The item on screen now, so a late answer for an earlier item is ignored. */
  const shownId = useRef(item.id);
  shownId.current = item.id;

  useEffect(() => {
    let live = true;
    setSrc(null);
    setPlayback({ state: 'still' });
    void loadLarge(item).then((url) => {
      if (live && url) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [item, loadLarge]);

  const isVideo = item.kind === 'video';
  const canPlay = isVideo && loadVideo !== undefined;

  // Google's video servers take 5–15 s to answer the first time a video is asked for. Start
  // finding the stream as soon as the video is on screen (after a short pause, so flicking
  // through doesn't wake every video), so ▶ is usually instant. The answer is remembered.
  useEffect(() => {
    if (!canPlay) return;
    const timer = setTimeout(() => void loadVideo(item, undefined, 'stream'), 400);
    return () => clearTimeout(timer);
  }, [item, canPlay, loadVideo]);
  const duration = typeof item.durationSec === 'number' ? formatDuration(item.durationSec) : null;

  const load = (how: 'stream' | 'download') => {
    if (!loadVideo) return;
    const forItem = item.id;
    const current = () => shownId.current === forItem;
    setPlayback({ state: 'loading', fraction: null });
    void loadVideo(
      item,
      (fraction) => {
        if (current()) setPlayback({ state: 'loading', fraction });
      },
      how,
    ).then((r) => {
      if (!current()) return;
      if (r.ok) setPlayback({ state: 'playing', url: r.url, streamed: how === 'stream' });
      else if (how === 'stream') fallBack();
      else setPlayback({ state: 'failed', tooBig: r.reason === 'too-big' });
    });
  };

  /** Streaming didn't work: download short videos whole, send long ones to Google Photos. */
  const fallBack = () => {
    if ((item.durationSec ?? 0) <= DOWNLOAD_MAX_SECONDS) load('download');
    else setPlayback({ state: 'failed', tooBig: true });
  };

  if (playback.state === 'playing') {
    return (
      <div class="large-photo">
        <video
          key={playback.url}
          src={playback.url}
          poster={src ?? undefined}
          controls
          autoPlay
          playsInline
          aria-label={alt}
          onPointerDown={stop}
          onError={() =>
            playback.streamed ? fallBack() : setPlayback({ state: 'failed', tooBig: false })
          }
        />
      </div>
    );
  }

  const loading = playback.state === 'loading';
  return (
    <div class={`large-photo${isVideo ? ' is-video' : ''}`}>
      {src ? <img src={src} alt={alt} /> : <Thumb item={item} alt={alt} />}
      {canPlay && playback.state !== 'failed' && (
        <button
          class={`play-video${loading ? ' loading' : ''}`}
          onPointerDown={stop}
          onClick={() => load('stream')}
          disabled={loading}
          aria-label={loading ? t('videoLoading') : t('playVideo')}
          title={t('playVideo')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        </button>
      )}
      {isVideo && duration && !loading && <span class="video-length">{duration}</span>}
      {loading && (
        <div class="video-status">
          <span>{t('videoLoading')}</span>
          {playback.fraction !== null && (
            <div
              class="video-progress"
              role="progressbar"
              aria-label={t('videoLoading')}
              aria-valuenow={Math.round(playback.fraction * 100)}
            >
              <span style={{ width: `${playback.fraction * 100}%` }} />
            </div>
          )}
        </div>
      )}
      {playback.state === 'failed' && (
        <p class="video-failed">{t(playback.tooBig ? 'videoTooBig' : 'videoFailed')}</p>
      )}
    </div>
  );
}
