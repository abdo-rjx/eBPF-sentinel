/** Render clock time from created_at only. window_start_ns is CLOCK_MONOTONIC, not epoch. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatScore(n: number): string {
  return n.toFixed(4);
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatRate(n: number): string {
  return `${Math.round(n)}`;
}

/** Informational only: the ns fields are monotonic durations, never clock times. */
export function formatWindowDuration(startNs: number, endNs: number): string {
  const ms = (endNs - startNs) / 1e6;
  return `${(ms / 1000).toFixed(1)}s`;
}
