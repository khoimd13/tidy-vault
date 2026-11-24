import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../../i18n';

/** Long enough to notice and react; paused while the pointer or focus is on the toast. */
const UNDO_MS = 10000;

interface ToastData {
  text: string;
  onUndo: () => void;
}

export function useToast() {
  const [data, setData] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setData(null);
  }, []);

  const startTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setData(null), UNDO_MS);
  }, []);

  const pause = useCallback(() => clearTimeout(timer.current), []);

  const show = useCallback(
    (text: string, onUndo: () => void) => {
      setData({ text, onUndo });
      startTimer();
    },
    [startTimer],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { data, show, hide, pause, resume: startTimer };
}

export type ToastApi = ReturnType<typeof useToast>;

/**
 * The live region is always in the DOM so screen readers announce new messages reliably.
 * It lives in App, so Undo survives moving between screens.
 */
export function Toast({ state }: { state: ToastApi }) {
  const { t } = useI18n();
  const { data } = state;
  return (
    <div
      class="toast-region"
      role="status"
      aria-live="polite"
      onMouseEnter={state.pause}
      onMouseLeave={state.resume}
      onFocusIn={state.pause}
      onFocusOut={state.resume}
    >
      {data && (
        <div class="toast">
          <span>{data.text}</span>
          <button
            class="link"
            onClick={() => {
              data.onUndo();
              state.hide();
            }}
          >
            {t('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
