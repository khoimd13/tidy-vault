/**
 * A big view of one photo: shows the stored thumbnail immediately, then swaps in a sharper
 * version fetched through the Google Photos tab when it arrives. Videos get a play button that
 * downloads the video itself (360p) through the Google Photos tab and plays it right here.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhotoItem } from '../../../shared/types';
import { useI18n } from '../../i18n';
import type { VideoLoad } from '../useVault';
import { Thumb } from './Thumb';

interface Props {
  item: PhotoItem;
  alt: string;
  loadLarge: (item: PhotoItem) => Promise<string | null>;
  /** Gets a video ready to play; omit to show videos as a still only. */
  loadVideo?: (
    item: PhotoItem,
    onProgress: (fraction: number | null) => void,
  ) => Promise<VideoLoad>;
}

type Playback =
  | { state: 'still' }
  | { state: 'loading'; fraction: number | null }
  | { state: 'playing'; url: string }
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

  const canPlay = item.kind === 'video' && loadVideo !== undefined;

  const play = () => {
    if (!loadVideo) return;
    setPlayback({ state: 'loading', fraction: null });
    const forItem = item.id;
    const current = () => shownId.current === forItem;
    void loadVideo(item, (fraction) => {
      if (current()) setPlayback({ state: 'loading', fraction });
    }).then((r) => {
      // Ignore an answer that arrives after the user moved on to another item.
      if (!current()) return;
      setPlayback(
        r.ok
          ? { state: 'playing', url: r.url }
          : { state: 'failed', tooBig: r.reason === 'too-big' },
      );
    });
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
          onError={() => setPlayback({ state: 'failed', tooBig: false })}
        />
      </div>
    );
  }

  return (
    <div class="large-photo">
      {src ? <img src={src} alt={alt} /> : <Thumb item={item} alt={alt} />}
      {canPlay && playback.state !== 'failed' && (
        <button
          class="play-video"
          onPointerDown={stop}
          onClick={play}
          disabled={playback.state === 'loading'}
          aria-label={playback.state === 'loading' ? t('videoLoading') : t('playVideo')}
          title={t('playVideo')}
        >
          {playback.state === 'loading' ? <span class="play-spinner" /> : '▶'}
        </button>
      )}
      {playback.state === 'loading' && playback.fraction !== null && (
        <div
          class="video-progress"
          role="progressbar"
          aria-label={t('videoLoading')}
          aria-valuenow={Math.round(playback.fraction * 100)}
        >
          <span style={{ width: `${playback.fraction * 100}%` }} />
        </div>
      )}
      {playback.state === 'failed' && (
        <p class="video-failed">{t(playback.tooBig ? 'videoTooBig' : 'videoFailed')}</p>
      )}
    </div>
  );
}
