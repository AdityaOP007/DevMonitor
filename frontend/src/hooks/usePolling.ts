import { useEffect, useRef } from 'react';

export interface PollingOptions {
  pauseWhenHidden?: boolean;
}

/**
 * Custom hook to poll an async callback periodically.
 * Executes immediately on mount, then every `intervalMs` (defaults to 15,000ms / 15s).
 * If `options.pauseWhenHidden` is true, pauses timer when browser tab is hidden
 * and immediately triggers callback when tab becomes visible.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 15000,
  options?: PollingOptions
): void {
  const savedCallback = useRef(callback);
  const pauseWhenHidden = options?.pauseWhenHidden ?? false;

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    // Execute immediately on mount
    savedCallback.current();

    let id: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (id !== null) clearInterval(id);
      id = setInterval(() => {
        if (!pauseWhenHidden || !document.hidden) {
          savedCallback.current();
        }
      }, intervalMs);
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (id !== null && pauseWhenHidden) {
          clearInterval(id);
          id = null;
        }
      } else {
        if (pauseWhenHidden) {
          // Refresh immediately when tab becomes visible
          savedCallback.current();
          startTimer();
        }
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (id !== null) clearInterval(id);
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, pauseWhenHidden]);
}
