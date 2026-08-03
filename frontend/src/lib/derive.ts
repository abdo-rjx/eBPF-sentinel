import { getSeverity } from '@/lib/severity';
import type { ProcessRow, SentinelWindow } from '@/types';

/** Client-normalized KPIs; either derived from windows or mapped from the API Stats payload. */
export interface DerivedStats {
  totalWindows: number;
  uniqueProcesses: number;
  anomalyCount: number;
  anomalyProcesses: number;
  avgSyscallRate: number;
  anomalyRatePct: number;
  maxAnomalyScore: number;
}

export function buildProcessRows(windows: SentinelWindow[]): ProcessRow[] {
  const latestById = new Map<number, SentinelWindow>();
  for (const w of windows) {
    const prev = latestById.get(w.pid);
    if (!prev || prev.id < w.id) latestById.set(w.pid, w);
  }

  return Array.from(latestById.values())
    .map((w) => {
      const pidWindows = windows.filter((x) => x.pid === w.pid);
      return {
        pid: w.pid,
        comm: w.comm,
        instances: pidWindows.length,
        anomalies: pidWindows.filter((x) => x.is_anomalous).length,
        fileOps: pidWindows.reduce(
          (acc, x) => acc + x.num_file_opens + x.num_file_renames + x.num_file_deletes,
          0,
        ),
        connects: pidWindows.reduce((acc, x) => acc + x.num_connect, 0),
        syscallRate: w.syscall_rate,
        score: w.anomaly_score,
        severity: getSeverity(w),
        latestId: w.id,
        latestWindow: w,
      };
    })
    .sort((a, b) => b.latestId - a.latestId);
}

export function computeDerivedStats(
  windows: SentinelWindow[],
  rows: ProcessRow[],
): DerivedStats {
  const anomalyWindows = windows.filter((w) => w.is_anomalous);
  const scores = windows.map((w) => w.anomaly_score);
  const avgRate = windows.length
    ? windows.reduce((acc, w) => acc + w.syscall_rate, 0) / windows.length
    : 0;
  return {
    totalWindows: windows.length,
    uniqueProcesses: rows.length,
    anomalyCount: anomalyWindows.length,
    anomalyProcesses: rows.filter((r) => r.severity === 'critical').length,
    avgSyscallRate: avgRate,
    anomalyRatePct: windows.length ? (anomalyWindows.length / windows.length) * 100 : 0,
    maxAnomalyScore: scores.length ? Math.min(...scores) : 0,
  };
}

export function normalizeApiStats(s: {
  total_windows: number;
  anomaly_count: number;
  unique_processes: number;
  anomaly_processes: number;
  avg_syscall_rate: number;
  anomaly_rate_pct: number;
  top_anomalies: Array<{ anomaly_score: number }>;
}): DerivedStats {
  return {
    totalWindows: s.total_windows,
    uniqueProcesses: s.unique_processes,
    anomalyCount: s.anomaly_count,
    anomalyProcesses: s.anomaly_processes,
    avgSyscallRate: s.avg_syscall_rate,
    anomalyRatePct: s.anomaly_rate_pct,
    maxAnomalyScore: s.top_anomalies[0]?.anomaly_score ?? 0,
  };
}
