import { useEffect, useRef } from 'react';

/**
 * Custom hook to poll an async callback periodically.
 * Executes immediately on mount, then every `intervalMs` (defaults to 15,000ms / 15s).
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number = 15000): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    // Execute immediately on mount
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);
}
