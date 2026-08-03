import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE, isDemoMode } from '@/lib/config';
import type { ConnectionState, StatsSource } from '@/types';

export interface SentinelContextValue {
  mode: ConnectionState;
  statsSource: StatsSource;
  lastError: string | null;
  demoMode: boolean;
  /** Lets the dashboard push its richer knowledge of connection state upward. */
  sync: (updates: { mode?: ConnectionState; statsSource?: StatsSource; lastError?: string | null }) => void;
}

const SentinelContext = createContext<SentinelContextValue | null>(null);

/**
 * App-root connection truth so the header pill works on every page without
 * prop drilling. Marketing pages only get the reachability probe; the
 * dashboard syncs its real SSE/REST state up via `sync`.
 */
export function SentinelProvider({ children }: { children: ReactNode }) {
  const demoMode = isDemoMode();
  const [mode, setMode] = useState<ConnectionState>(demoMode ? 'demo_mode' : 'connecting');
  const [statsSource, setStatsSource] = useState<StatsSource>(demoMode ? 'demo' : 'derived');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((res) => {
        if (!cancelled) {
          setMode(res.ok ? 'connected' : 'reconnecting');
          setStatsSource(res.ok ? 'api' : 'derived');
          if (res.ok) setLastError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setMode('reconnecting');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [demoMode]);

  const sync = useCallback(
    (updates: { mode?: ConnectionState; statsSource?: StatsSource; lastError?: string | null }) => {
      if (updates.mode !== undefined) setMode(updates.mode);
      if (updates.statsSource !== undefined) setStatsSource(updates.statsSource);
      if ('lastError' in updates) setLastError(updates.lastError ?? null);
    },
    [],
  );

  const value = useMemo(
    () => ({ mode, statsSource, lastError, demoMode, sync }),
    [mode, statsSource, lastError, demoMode, sync],
  );

  return <SentinelContext.Provider value={value}>{children}</SentinelContext.Provider>;
}

export function useSentinel(): SentinelContextValue {
  const ctx = useContext(SentinelContext);
  if (!ctx) throw new Error('useSentinel must be used within SentinelProvider');
  return ctx;
}
