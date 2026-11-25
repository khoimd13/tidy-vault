/**
 * The "reading your library" loader: a stack of photo frames with a sweeping scan line, an endless
 * gliding band, and a counter that counts up smoothly (the scanner reports in batches, which made
 * a plain number jump). Decorative parts are aria-hidden; still when reduced motion is preferred.
 */
import { useEffect, useRef, useState } from 'preact/hooks';

/** Eases the displayed number towards `target` instead of jumping. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    const tick = () => {
      const diff = target - shownRef.current;
      if (Math.abs(diff) < 1) {
        shownRef.current = target;
        setShown(target);
        return;
      }
      shownRef.current += diff * 0.12;
      setShown(Math.round(shownRef.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

interface Props {
  label: string;
  /** Builds the counter text from the (smoothly animated) number. */
  countText: (n: number) => string;
  count: number;
  paused: boolean;
}

export function ScanLoader({ label, countText, count, paused }: Props) {
  const shown = useCountUp(count);
  return (
    <div class={`scan-loader${paused ? ' paused' : ''}`} role="status">
      <div class="scan-frames" aria-hidden="true">
        <span />
        <span />
        <span />
        <i class="scan-line" />
      </div>
      <div class="scan-body">
        <div class="row">
          <strong>{label}</strong>
          <span class="muted scan-count">{countText(shown)}</span>
        </div>
        <div class="scan-track" aria-hidden="true">
          <div class="scan-band" />
        </div>
      </div>
    </div>
  );
}
