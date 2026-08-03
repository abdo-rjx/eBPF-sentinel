import type { Severity, SentinelWindow } from '@/types';

/**
 * sklearn sign convention: decision_function() is NEGATIVE for anomalies.
 * is_anomalous is the authoritative flag; do not invert the score.
 */
export function getSeverity(w: Pick<SentinelWindow, 'is_anomalous' | 'anomaly_score'>): Severity {
  if (w.is_anomalous) return 'critical';
  if (w.anomaly_score < 0) return 'suspicious';
  return 'benign';
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'CRITICAL',
  suspicious: 'SUSPICIOUS',
  benign: 'BENIGN',
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  suspicious: 1,
  benign: 2,
};
