import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Panel } from '@/components/ui/Panel';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useSentinel } from '@/context/SentinelContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useKeyPress } from '@/hooks/useKeyPress';
import { getAnalysis } from '@/lib/api/client';
import { formatCount, formatRate, formatScore, formatTime, formatWindowDuration } from '@/lib/format';
import { getSeverity, SEVERITY_ORDER } from '@/lib/severity';
import type {
  FeatureContribution,
  ProcessRow,
  SentinelWindow,
  WindowAnalysis,
} from '@/types';
import styles from './Dashboard.module.css';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FEATURE_FIELDS: ReadonlyArray<{ key: keyof SentinelWindow; label: string }> = [
  { key: 'num_execve', label: 'EXEC' },
  { key: 'num_distinct_children', label: 'CHLD' },
  { key: 'num_file_opens', label: 'OPEN' },
  { key: 'num_file_renames', label: 'RENM' },
  { key: 'num_file_deletes', label: 'DEL' },
  { key: 'num_distinct_files_touched', label: 'FILES' },
  { key: 'num_connect', label: 'CONN' },
  { key: 'num_distinct_dest_ips', label: 'IP' },
  { key: 'num_setuid', label: 'UID' },
  { key: 'syscall_rate', label: 'RATE' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] ?? 0;
  return ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Client-side attribution when /analysis is unreachable: z-score each feature against the dataset median. */
function fallbackContributions(w: SentinelWindow, pool: SentinelWindow[]): FeatureContribution[] {
  return FEATURE_FIELDS.map(({ key, label }) => {
    const value = Number(w[key]);
    const baseline = pool.map((p) => Number(p[key]));
    const med = median(baseline);
    const mad = median(baseline.map((x) => Math.abs(x - med)));
    const z = mad === 0 ? (value === med ? 0 : value > med ? 3 : -3) : (value - med) / mad;
    const severity: FeatureContribution['severity'] = z >= 3 ? 'high' : z >= 1 ? 'medium' : 'low';
    return {
      feature: key as string,
      label,
      value,
      baseline_mean: med,
      baseline_std: mad,
      z_score: z,
      severity,
    };
  }).sort((a, b) => b.z_score - a.z_score);
}

export default function Dashboard() {
  const data = useDashboardData();
  const { sync } = useSentinel();
  const [selected, setSelected] = useState<ProcessRow | null>(null);

  useEffect(() => {
    sync({
      mode: data.connectionState,
      statsSource: data.statsSource,
      lastError: data.lastError,
    });
  }, [sync, data.connectionState, data.statsSource, data.lastError]);

  const demo = data.status === 'demo';
  const skeleton = data.windows.length === 0 && (data.status === 'loading' || demo);
  const empty = !demo && data.windows.length === 0 && data.status !== 'loading';

  return (
    <div className={styles.page}>
      <StatusStrip
        statsSource={data.statsSource}
        lastError={data.lastError}
        onRefresh={data.refresh}
      />

      {skeleton ? (
        <DashboardSkeleton />
      ) : empty ? (
        <EmptyGuide />
      ) : (
        <>
          <KpiRow stats={data.stats} />
          <TimelinePanel windows={data.windows} />
          <ProcessTable
            processes={data.processes}
            newProcesses={data.newProcesses}
            onSelect={setSelected}
          />
          {demo && <SimulationGuide />}
        </>
      )}

      <AnimatePresence>
        {selected && (
          <DetailDrawer
            key="detail"
            row={selected}
            pool={data.windows}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusStrip({
  statsSource,
  lastError,
  onRefresh,
}: {
  statsSource: string;
  lastError: string | null;
  onRefresh: () => void;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className="label">Sentinel · Live Console</p>
        <h1 className={styles.title}>Behavioral Telemetry</h1>
      </div>
      <div className={styles.actions}>
        {lastError && (
          <span className={styles.error} role="status">
            {lastError}
          </span>
        )}
        <span className={styles.chip}>
          source · <span className={styles.chipStrong}>{statsSource}</span>
        </span>
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          <RefreshCw size={12} aria-hidden="true" />
          Refresh
        </Button>
      </div>
    </header>
  );
}

function KpiRow({ stats }: { stats: ReturnType<typeof useDashboardData>['stats'] }) {
  return (
    <div className={styles.kpi}>
      <StatCard label="Total Windows" value={formatCount(stats.totalWindows)} hint="scored 5s windows in view" />
      <StatCard label="Unique Processes" value={formatCount(stats.uniqueProcesses)} hint="distinct pids observed" />
      <StatCard
        label="Anomalies"
        value={formatCount(stats.anomalyCount)}
        hint={`${stats.anomalyProcesses} processes flagged`}
        tone={stats.anomalyCount > 0 ? 'danger' : 'default'}
      />
      <StatCard label="Syscall Rate" value={formatRate(stats.avgSyscallRate)} hint="avg syscalls / second" />
      <StatCard
        label="Anomaly Rate"
        value={`${stats.anomalyRatePct.toFixed(1)}%`}
        hint={`worst score ${formatScore(stats.maxAnomalyScore)}`}
        tone="accent"
      />
    </div>
  );
}

function TimelinePanel({ windows }: { windows: SentinelWindow[] }) {
  const critical = windows.filter((w) => w.is_anomalous).length;
  return (
    <Panel
      title="Anomaly Score Timeline"
      meta={`${windows.length} WINDOWS · ${critical} CRITICAL`}
    >
      <AnomalyTimeline windows={windows} />
    </Panel>
  );
}

const W = 1000;
const H = 180;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOT = 22;

function AnomalyTimeline({ windows }: { windows: SentinelWindow[] }) {
  const list = useMemo(() => [...windows].reverse(), [windows]);
  const n = list.length;
  const critical = windows.filter((w) => w.is_anomalous).length;

  if (n === 0) return null;

  const yFor = (score: number) => {
    const t = clamp((score + 0.5) / 1.0, 0, 1);
    return PAD_TOP + (1 - t) * (H - PAD_TOP - PAD_BOT);
  };
  const xFor = (i: number) => (n === 1 ? W / 2 : PAD_X + (i / (n - 1)) * (W - PAD_X * 2));
  const pts: Array<[number, number]> = list.map((w, i) => [xFor(i), yFor(w.anomaly_score)]);

  return (
    <svg
      className={styles.timeline}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Anomaly score timeline: ${n} windows, ${critical} critical`}
    >
      <line className={styles.grid} x1={PAD_X} y1={yFor(0.25)} x2={W - PAD_X} y2={yFor(0.25)} />
      <line className={styles.baseline} x1={PAD_X} y1={yFor(0)} x2={W - PAD_X} y2={yFor(0)} />
      <line className={styles.grid} x1={PAD_X} y1={yFor(-0.25)} x2={W - PAD_X} y2={yFor(-0.25)} />

      <polyline
        className={styles.trace}
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
      />

      {pts.map(([x, y], i) => {
        const w = list[i];
        if (!w) return null;
        const sev = getSeverity(w);
        const r = sev === 'critical' ? 5 : sev === 'suspicious' ? 3.5 : 2.5;
        return <circle key={w.id} className={`${styles.dot} ${styles[`dot-${sev}`]}`} cx={x} cy={y} r={r} />;
      })}

      <text className={styles.axisLabel} x={2} y={yFor(0) - 4}>
        +0.5
      </text>
      <text className={styles.axisLabel} x={2} y={yFor(-0.5) + 10}>
        −0.5
      </text>
      <text className={styles.axisNote} x={W - PAD_X} y={H - 6} textAnchor="end">
        NEWEST →
      </text>
    </svg>
  );
}

function ProcessTable({
  processes,
  newProcesses,
  onSelect,
}: {
  processes: ProcessRow[];
  newProcesses: Set<number>;
  onSelect: (row: ProcessRow) => void;
}) {
  const sorted = useMemo(
    () =>
      [...processes].sort((a, b) => {
        const bySev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (bySev !== 0) return bySev;
        return a.score - b.score;
      }),
    [processes],
  );

  return (
    <Panel title="Process Activity" meta={`${processes.length} PROCESSES`}>
      <div className={styles.tableScroll}>
        <div className={styles.tableHead}>
          <span>Severity</span>
          <span>Process</span>
          <span className={styles.numHead}>Windows</span>
          <span className={styles.numHead}>Anom</span>
          <span className={styles.numHead}>File Ops</span>
          <span className={styles.numHead}>Conn</span>
          <span className={styles.numHead}>Rate</span>
          <span className={styles.numHead}>Score</span>
        </div>
        <ul className={styles.rows}>
          {sorted.map((row) => {
            const sev = row.severity;
            const isNew = newProcesses.has(row.pid);
            return (
              <li key={row.pid}>
                <button
                  type="button"
                  className={`${styles.row}${
                    sev === 'critical'
                      ? ` ${styles['row-critical']}`
                      : sev === 'suspicious'
                        ? ` ${styles['row-suspicious']}`
                        : ''
                  }`}
                  onClick={() => onSelect(row)}
                  aria-label={`Open ${row.comm} pid ${row.pid}, ${sev} details`}
                >
                  <span className={styles.cellSev}>
                    <SeverityBadge severity={sev} />
                  </span>
                  <span className={styles.cellProc}>
                    <span className={styles.comm}>{row.comm}</span>
                    <span className={styles.pid}>
                      pid {row.pid}
                      {isNew && <span className={styles.newTag}>NEW</span>}
                    </span>
                  </span>
                  <span className={styles.cellNum}>{formatCount(row.instances)}</span>
                  <span className={styles.cellNum}>{formatCount(row.anomalies)}</span>
                  <span className={styles.cellNum}>{formatCount(row.fileOps)}</span>
                  <span className={styles.cellNum}>{formatCount(row.connects)}</span>
                  <span className={styles.cellNum}>{formatRate(row.syscallRate)}</span>
                  <span className={`${styles.cellScore} ${styles[`score-${sev}`]}`}>
                    {formatScore(row.score)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function DetailDrawer({
  row,
  pool,
  onClose,
}: {
  row: ProcessRow;
  pool: SentinelWindow[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = row.latestWindow;

  useFocusTrap(true, ref);
  useKeyPress('Escape', onClose, true);

  return (
    <motion.div
      className={styles.drawerLayer}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      <div className={styles.overlay} onClick={onClose} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={styles.drawer}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <header className={styles.drawerHead}>
          <div className={styles.drawerTitleWrap}>
            <p className="label">Process Detail</p>
            <h2 id="drawer-title" className={styles.drawerTitle}>
              <span className={styles.comm}>{w.comm}</span>
              <span className={styles.pid}> pid {w.pid}</span>
            </h2>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close details">
            <X size={16} aria-hidden="true" />
          </Button>
        </header>

        <div className={styles.drawerBody}>
          <div className={styles.drawerSev}>
            <SeverityBadge severity={getSeverity(w)} />
            <span className={styles.score}>
              score {formatScore(w.anomaly_score)}
            </span>
          </div>

          <dl className={styles.detailGrid}>
            <DetailItem label="Window" value={`#${w.id}`} />
            <DetailItem label="PPID" value={String(w.ppid)} />
            <DetailItem label="Observed" value={formatTime(w.created_at)} />
            <DetailItem label="Duration" value={formatWindowDuration(w.window_start_ns, w.window_end_ns)} />
            <DetailItem label="Syscall Rate" value={formatRate(w.syscall_rate)} />
            <DetailItem label="Dest. IPs" value={formatCount(w.num_distinct_dest_ips)} />
          </dl>

          <Panel title="Feature Vector">
            <FeatureBars window={w} />
          </Panel>

          <Panel title="Explainability">
            <AnalysisPanel window={w} pool={pool} />
          </Panel>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.detailItem}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  );
}

function FeatureBars({ window: w }: { window: SentinelWindow }) {
  const values = FEATURE_FIELDS.map((f) => Number(w[f.key]));
  const max = Math.max(1, ...values);
  return (
    <div className={styles.bars}>
      {FEATURE_FIELDS.map((f, i) => {
        const v = values[i] ?? 0;
        const flag =
          v > 0 && (f.key === 'num_file_renames' || f.key === 'num_file_deletes' || f.key === 'num_setuid');
        return (
          <div key={f.key} className={styles.bar}>
            <span className={styles.barLabel}>{f.label}</span>
            <span className={styles.barTrack}>
              <span
                className={`${styles.barFill} ${flag ? styles.barFillFlag : ''}`}
                style={{ width: `${(v / max) * 100}%` }}
              />
            </span>
            <span className={styles.barValue}>{formatCount(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnalysisPanel({ window: w, pool }: { window: SentinelWindow; pool: SentinelWindow[] }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [analysis, setAnalysis] = useState<WindowAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getAnalysis(w.id)
      .then((a) => {
        if (cancelled) return;
        if (a) {
          setAnalysis(a);
          setState('ok');
        } else {
          setState('error');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [w.id]);

  if (state === 'loading') {
    return (
      <div className={styles.analysis} aria-busy="true">
        <Skeleton className={styles.loadLine} />
        <Skeleton className={styles.loadLine} />
        <Skeleton className={styles.loadLine} />
      </div>
    );
  }

  const contributor = (c: FeatureContribution) => (
    <div key={c.feature} className={styles.contribRow}>
      <span className={styles.contribLabel}>{c.label}</span>
      <span className={styles.contribScore}>{formatScore(c.z_score)}</span>
      <span className={`${styles.contribSev} ${styles[c.severity]}`}>{c.severity.toUpperCase()}</span>
    </div>
  );

  if (state === 'ok' && analysis) {
    return (
      <div className={styles.analysis}>
        <p className={styles.analysisMeta}>Isolation Forest attribution · z vs training baseline</p>
        <p className={styles.analysisSummary}>{analysis.summary}</p>
        <div>{analysis.top_contributors.slice(0, 6).map(contributor)}</div>
      </div>
    );
  }

  const elevated = fallbackContributions(w, pool)
    .filter((c) => c.z_score >= 0.5)
    .slice(0, 6);
  return (
    <div className={styles.analysis}>
      <p className={styles.analysisMeta}>Live analysis unavailable · deviation vs dataset median</p>
      {elevated.length === 0 ? (
        <p className={styles.analysisSummary}>No feature deviates from the observed dataset.</p>
      ) : (
        <div>{elevated.map(contributor)}</div>
      )}
    </div>
  );
}

function EmptyGuide() {
  return (
    <Panel title="Waiting for Telemetry">
      <div className={styles.guide}>
        <p className={styles.guideText}>
          No scored windows yet. The eBPF collector must be running on a Linux host; on this machine, run the
          bundled attack simulators to push events through the pipeline.
        </p>
        <div className={styles.guideList}>
          <GuideStep n={1} text="Start the backend with an auth token" />
          <GuideStep n={2} text="Point the frontend at it via frontend/.env" />
          <GuideStep n={3} text="python test/simulate_ransomware.py" />
        </div>
        <CodeBlock title="frontend/.env">
          {`VITE_API_BASE=http://localhost:8000\nVITE_API_TOKEN=<your-token>`}
        </CodeBlock>
      </div>
    </Panel>
  );
}

function GuideStep({ n, text }: { n: number; text: string }) {
  return (
    <p className={styles.guideStep}>
      <span className={styles.stepNum}>{n}</span>
      {text}
    </p>
  );
}

function SimulationGuide() {
  return (
    <Panel title="Going Live" meta="DEMO">
      <div className={styles.guide}>
        <p className={styles.guideText}>
          This console is running on synthesized data. To observe real anomalies, bring up the pipeline and let
          Sentinel flag a suspicious process within ~5 seconds.
        </p>
        <div className={styles.guideList}>
          <GuideStep n={1} text="cd backend && source .venv/bin/activate" />
          <GuideStep n={2} text="export API_AUTH_TOKEN=<t> && uvicorn sentinel_backend.api.main:app" />
          <GuideStep n={3} text="On Linux: sudo ./run.sh (collector) then python test/simulate_ransomware.py" />
        </div>
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className={styles.kpi}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={styles.skelCard} />
        ))}
      </div>
      <Skeleton className={styles.skelBlock} />
      <Skeleton className={styles.skelBlock} />
    </div>
  );
}
