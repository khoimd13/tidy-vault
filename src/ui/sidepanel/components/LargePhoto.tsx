/**
 * A big view of one photo: shows the stored thumbnail immediately, then swaps in a sharper
 * version fetched through the Google Photos tab when it arrives.
 */
import { useEffect, useState } from 'preact/hooks';
import type { PhotoItem } from '../../../shared/types';
import { Thumb } from './Thumb';

interface Props {
  item: PhotoItem;
  alt: string;
  loadLarge: (item: PhotoItem) => Promise<string | null>;
}

export function LargePhoto({ item, alt, loadLarge }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSrc(null);
    void loadLarge(item).then((url) => {
      if (live && url) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [item, loadLarge]);

  return (
    <div class="large-photo">
      {src ? <img src={src} alt={alt} /> : <Thumb item={item} alt={alt} />}
    </div>
  );
}
