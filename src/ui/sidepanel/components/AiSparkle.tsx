/**
 * The "AI is thinking" loader: three four-pointed sparkles that twinkle and turn in turn, next
 * to shimmering text. Purely decorative (aria-hidden); the text carries the meaning. Respects
 * prefers-reduced-motion (see styles.css).
 */
import type { ComponentChildren } from 'preact';

const STAR =
  'M12 0 C13 7.5 16.5 11 24 12 C16.5 13 13 16.5 12 24 C11 16.5 7.5 13 0 12 C7.5 11 11 7.5 12 0 Z';

function Sparkles() {
  return (
    <svg class="sparkles" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
      <defs>
        <linearGradient id="vt-spark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d9ccff" />
          <stop offset="0.55" stop-color="#b9a4ff" />
          <stop offset="1" stop-color="#ff9ad5" />
        </linearGradient>
      </defs>
      <g class="spark s1" transform="translate(8 8) scale(1)">
        <path d={STAR} fill="url(#vt-spark)" />
      </g>
      <g class="spark s2" transform="translate(1 1) scale(0.42)">
        <path d={STAR} fill="url(#vt-spark)" />
      </g>
      <g class="spark s3" transform="translate(27 26) scale(0.5)">
        <path d={STAR} fill="url(#vt-spark)" />
      </g>
    </svg>
  );
}

interface Props {
  /** Main line, e.g. "AI is looking at your photos…". */
  label: string;
  /** Optional right-aligned detail, e.g. "120 of 800". */
  detail?: string;
  /** 0..1 for a progress bar under the text; omitted while waking up. */
  progress?: number;
  children?: ComponentChildren;
}

export function AiSparkle({ label, detail, progress }: Props) {
  return (
    <div class="ai-loader" role="status">
      <Sparkles />
      <div class="ai-loader-body">
        <div class="row">
          <span class="ai-shimmer">{label}</span>
          {detail && <span class="muted">{detail}</span>}
        </div>
        {progress !== undefined && (
          <div class="ai-track" aria-hidden="true">
            <div class="ai-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
