import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProcesses, getStats, getWindows } from '@/lib/api/client';
import { isDemoMode } from '@/lib/config';
import {
  buildProcessRows,
  computeDerivedStats,
  normalizeApiStats,
  type DerivedStats,
} from '@/lib/derive';
import { useSentinelStream } from '@/hooks/useSentinelStream';
import type {
  ConnectionState,
  DashboardStatus,
  ProcessRow,
  ProcessSummary,
  SentinelWindow,
  Stats,
  StatsSource,
} from '@/types';

export interface DashboardData {
  windows: SentinelWindow[];
  processes: ProcessRow[];
  newProcesses: Set<number>;
  stats: DerivedStats;
  apiStats: Stats | null;
  status: DashboardStatus;
  connectionState: ConnectionState;
  statsSource: StatsSource;
  lastError: string | null;
  refresh: () => void;
}

const SEED_LIMIT = 50;
const MAX_WINDOWS = 200;
const STATS_REFRESH_MS = 15000;

function dedupeMerge(stream: SentinelWindow[], rest: SentinelWindow[]): SentinelWindow[] {
  const byId = new Map<number, SentinelWindow>();
  for (const w of stream) byId.set(w.id, w); // SSE wins on duplicate id
  for (const w of rest) if (!byId.has(w.id)) byId.set(w.id, w);
  return Array.from(byId.values())
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_WINDOWS);
}

/**
 * Dashboard data source. Demo mode delegates to the mock stream entirely;
 * live mode seeds from REST (stats/processes/windows), then merges the SSE
 * stream and reconciles /stats every 15s and on anomalous arrivals.
 */
export function useDashboardData(): DashboardData {
  const demo = isDemoMode();
  const stream = useSentinelStream();

  const [restWindows, setRestWindows] = useState<SentinelWindow[]>([]);
  const [restProcesses, setRestProcesses] = useState<ProcessSummary[]>([]);
  const [apiStats, setApiStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<DashboardStatus>(demo ? 'demo' : 'loading');
  const [lastError, setLastError] = useState<string | null>(null);

  const seed = useCallback(async () => {
    if (demo) return;
    setStatus('loading');
    const [statsRes, procsRes, winsRes] = await Promise.allSettled([
      getStats(),
      getProcesses(),
      getWindows({ limit: SEED_LIMIT }),
    ]);

    const ok = statsRes.status === 'fulfilled' && statsRes.value !== null;
    if (ok) setApiStats(statsRes.value);
    if (procsRes.status === 'fulfilled') setRestProcesses(procsRes.value);
    if (winsRes.status === 'fulfilled') setRestWindows(winsRes.value);

    const failures = [statsRes, procsRes, winsRes].filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null),
    ).length;
    setStatus(failures === 0 ? 'live' : 'degraded');
    setLastError(
      failures === 0 ? null : 'REST seed failed — dashboard is serving the live SSE stream only.',
    );
  }, [demo]);

  useEffect(() => {
    void seed();
  }, [seed]);

  // Periodic /stats reconciliation.
  useEffect(() => {
    if (demo) return;
    const timer = setInterval(() => {
      getStats()
        .then((s) => {
          if (s) {
            setApiStats(s);
            setLastError(null);
            setStatus('live');
          }
        })
        .catch(() => {
          /* keep last known stats; degraded state self-reports via seed/SSE */
        });
    }, STATS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [demo]);

  // Reconcile stats immediately when a new anomalous window arrives.
  const lastAnomalousId = useRef<number>(0);
  useEffect(() => {
    if (demo) return;
    const newest = stream.windows[0];
    if (!newest || !newest.is_anomalous || newest.id === lastAnomalousId.current) return;
    lastAnomalousId.current = newest.id;
    getStats()
      .then((s) => {
        if (s) setApiStats(s);
      })
      .catch(() => {});
  }, [stream.windows, demo]);

  const windows = useMemo(
    () => (demo ? stream.windows : dedupeMerge(stream.windows, restWindows)),
    [demo, stream.windows, restWindows],
  );

  const processes = useMemo(() => {
    const rows = buildProcessRows(windows);
    if (demo || restProcesses.length === 0) return rows;
    // Enrich derived rows with DB-accurate counts when the DB knows more than our window cap.
    const byPid = new Map(restProcesses.map((p) => [p.pid, p]));
    return rows.map((r) => {
      const db = byPid.get(r.pid);
      if (!db) return r;
      return {
        ...r,
        instances: Math.max(r.instances, db.windows),
        anomalies: Math.max(r.anomalies, db.anomalies),
      };
    });
  }, [windows, restProcesses, demo]);

  const derived = useMemo(() => computeDerivedStats(windows, processes), [windows, processes]);
  const stats = useMemo(
    () => (apiStats ? normalizeApiStats(apiStats) : derived),
    [apiStats, derived],
  );

  const statsSource: StatsSource = demo ? 'demo' : apiStats ? 'api' : 'derived';

  return {
    windows,
    processes,
    newProcesses: stream.newProcesses,
    stats,
    apiStats,
    status,
    connectionState: stream.connectionState,
    statsSource,
    lastError,
    refresh: () => void seed(),
  };
}
