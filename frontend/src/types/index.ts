export type Severity = 'critical' | 'suspicious' | 'benign';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'demo_mode';

export type DashboardStatus = 'loading' | 'live' | 'degraded' | 'demo';

export type StatsSource = 'api' | 'derived' | 'demo';

/** One scored 5-second window. Mirror of backend WindowOut (api/schemas.py). */
export interface SentinelWindow {
  id: number;
  pid: number;
  ppid: number;
  comm: string;
  window_start_ns: number;
  window_end_ns: number;
  num_execve: number;
  num_distinct_children: number;
  num_file_opens: number;
  num_file_renames: number;
  num_file_deletes: number;
  num_distinct_files_touched: number;
  num_connect: number;
  num_distinct_dest_ips: number;
  num_setuid: number;
  syscall_rate: number;
  anomaly_score: number;
  is_anomalous: boolean;
  created_at: string;
}

export interface ProcessSummary {
  pid: number;
  comm: string;
  windows: number;
  anomalies: number;
}

export interface Stats {
  total_windows: number;
  anomaly_count: number;
  unique_processes: number;
  anomaly_processes: number;
  avg_syscall_rate: number;
  anomaly_rate_pct: number;
  top_anomalies: Array<{
    pid: number;
    comm: string;
    anomaly_score: number;
    window_start_ns: number;
  }>;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  value: number;
  baseline_mean: number;
  baseline_std: number;
  z_score: number;
  severity: 'high' | 'medium' | 'low';
}

export interface WindowAnalysis {
  window_id: number;
  anomaly_score: number;
  is_anomalous: boolean;
  feature_count: number;
  contributions: FeatureContribution[];
  top_contributors: FeatureContribution[];
  summary: string;
}

/** Client-derived per-process row: latest window per pid + aggregates. */
export interface ProcessRow {
  pid: number;
  comm: string;
  instances: number;
  anomalies: number;
  fileOps: number;
  connects: number;
  syscallRate: number;
  score: number;
  severity: Severity;
  latestId: number;
  latestWindow: SentinelWindow;
}
