import { useEffect } from 'react';

/** Invoke `handler` when `key` is pressed (while `enabled`). */
export function useKeyPress(key: string, handler: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === key) handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler, enabled]);
}
