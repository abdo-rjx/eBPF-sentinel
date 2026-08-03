import { z } from 'zod';

/**
 * Runtime guards for the backend wire formats. These are deliberately
 * permissive: a malformed record is dropped, never allowed to crash the
 * dashboard (the backend already tolerates malformed NDJSON the same way).
 */
export const windowSchema = z.object({
  id: z.number(),
  pid: z.number(),
  ppid: z.number(),
  comm: z.string(),
  window_start_ns: z.number(),
  window_end_ns: z.number(),
  num_execve: z.number(),
  num_distinct_children: z.number(),
  num_file_opens: z.number(),
  num_file_renames: z.number(),
  num_file_deletes: z.number(),
  num_distinct_files_touched: z.number(),
  num_connect: z.number(),
  num_distinct_dest_ips: z.number(),
  num_setuid: z.number(),
  syscall_rate: z.number(),
  anomaly_score: z.number(),
  is_anomalous: z.boolean(),
  created_at: z.string(),
});

export type WindowRecord = z.infer<typeof windowSchema>;

export function parseWindow(x: unknown): WindowRecord | null {
  const r = windowSchema.safeParse(x);
  if (!r.success) {
    console.warn('Dropped malformed window record:', r.error.issues);
    return null;
  }
  return r.data;
}

export const statsSchema = z.object({
  total_windows: z.number(),
  anomaly_count: z.number(),
  unique_processes: z.number(),
  anomaly_processes: z.number(),
  avg_syscall_rate: z.number(),
  anomaly_rate_pct: z.number(),
  top_anomalies: z.array(
    z.object({
      pid: z.number(),
      comm: z.string(),
      anomaly_score: z.number(),
      window_start_ns: z.number(),
    }),
  ),
});

export const processesSchema = z.array(
  z.object({
    pid: z.number(),
    comm: z.string(),
    windows: z.number(),
    anomalies: z.number(),
  }),
);

export const contributionSchema = z.object({
  feature: z.string(),
  label: z.string(),
  value: z.number(),
  baseline_mean: z.number(),
  baseline_std: z.number(),
  z_score: z.number(),
  severity: z.enum(['high', 'medium', 'low']),
});

export const analysisSchema = z.object({
  window_id: z.number(),
  anomaly_score: z.number(),
  is_anomalous: z.boolean(),
  feature_count: z.number(),
  contributions: z.array(contributionSchema),
  top_contributors: z.array(contributionSchema),
  summary: z.string(),
});
