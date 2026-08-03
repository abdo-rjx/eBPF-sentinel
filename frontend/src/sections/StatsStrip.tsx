import { useEffect, useState } from 'react';
import { getStats } from '@/lib/api/client';
import { isDemoMode } from '@/lib/config';
import { formatCount, formatRate } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { Reveal } from '@/components/ui/Reveal';
import type { Stats } from '@/types';
import styles from './StatsStrip.module.css';

export function StatsStrip() {
  const demo = isDemoMode();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await getStats();
        if (s && !cancelled) setStats(s);
      } catch {
        /* backend unreachable — keep '—' values */
      }
    };
    void poll();
    const timer = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [demo]);

  const hint = demo ? 'sample data' : stats ? 'live backend' : 'offline';

  interface StripItem {
    label: string;
    value: string;
    hint: string;
    tone: 'default' | 'accent' | 'danger';
  }

  const items: StripItem[] = stats
    ? [
        { label: 'Windows scored', value: formatCount(stats.total_windows), hint: '24h retention', tone: 'default' },
        { label: 'Processes tracked', value: formatCount(stats.unique_processes), hint: 'unique pids', tone: 'default' },
        {
          label: 'Anomalies flagged',
          value: formatCount(stats.anomaly_count),
          hint: `${stats.anomaly_rate_pct.toFixed(1)}% of windows`,
          tone: 'danger',
        },
        { label: 'Avg syscall rate', value: formatRate(stats.avg_syscall_rate), hint: 'calls / 5s', tone: 'default' },
      ]
    : [
        { label: 'Windows scored', value: '—', hint, tone: 'default' },
        { label: 'Processes tracked', value: '—', hint, tone: 'default' },
        { label: 'Anomalies flagged', value: '—', hint, tone: 'default' },
        { label: 'Avg syscall rate', value: '—', hint, tone: 'default' },
      ];

  return (
    <section className={styles.strip} aria-label="Detection statistics">
      <div className="container">
        <div className={styles.grid}>
          {items.map((item, i) => (
            <Reveal key={item.label} delay={i * 0.06}>
              <StatCard label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
