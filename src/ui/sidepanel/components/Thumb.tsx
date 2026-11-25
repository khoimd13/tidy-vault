/**
 * Shows a photo's thumbnail from local storage. Google's thumbnail links only work with the
 * Google session (which the panel may not have), so screens never load them directly.
 */
import { useEffect, useState } from 'preact/hooks';
import type { PhotoItem } from '../../../shared/types';
import * as store from '../../../store/db';

/** Object URLs by photo id, shared by every Thumb on the page. */
const urls = new Map<string, Promise<string | null>>();

function thumbUrl(id: string): Promise<string | null> {
  let url = urls.get(id);
  if (!url) {
    url = store
      .getThumb(id)
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    urls.set(id, url);
  }
  return url;
}

/** Forget cached images, e.g. after "Clear local data". */
export function clearThumbCache(): void {
  for (const url of urls.values()) void url.then((u) => u && URL.revokeObjectURL(u));
  urls.clear();
}

interface Props {
  item: PhotoItem;
  alt?: string;
}

export function Thumb({ item, alt = '' }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  /** An image that fails to load shows the neutral placeholder, not its alt text. */
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let live = true;
    void thumbUrl(item.id).then((u) => {
      if (!live) return;
      if (u) setSrc(u);
      else urls.delete(item.id); // not stored yet: try again next time this mounts
    });
    return () => {
      live = false;
    };
  }, [item.id]);

  // Preview harness data uses plain local images; real Google links are never loaded here.
  const fallback = item.thumbUrl.startsWith('/') || item.thumbUrl.startsWith('data:');
  const shown = src ?? (fallback ? item.thumbUrl : null);
  return shown && !broken ? (
    <img src={shown} alt={alt} loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span class="thumb-placeholder" role="img" aria-label={alt} />
  );
}
