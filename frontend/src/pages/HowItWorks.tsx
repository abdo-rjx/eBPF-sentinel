import { PageHeader } from '@/components/layout/PageHeader';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Reveal } from '@/components/ui/Reveal';
import { FEATURES } from '@/lib/data/threats';
import styles from './HowItWorks.module.css';

const SECTIONS = [
  { id: 'syscalls', n: '01', label: 'The seven syscalls' },
  { id: 'windowing', n: '02', label: 'Windowing' },
  { id: 'features', n: '03', label: 'Feature vector' },
  { id: 'scoring', n: '04', label: 'Scoring' },
  { id: 'explain', n: '05', label: 'Explainability' },
  { id: 'retention', n: '06', label: 'Retention' },
];

const SYSCALLS = [
  { name: 'execve', detail: 'Program execution' },
  { name: 'connect', detail: 'Outbound connection attempt' },
  { name: 'accept', detail: 'Inbound connection accepted' },
  { name: 'openat', detail: 'File open' },
  { name: 'unlink', detail: 'File deletion' },
  { name: 'rename', detail: 'File rename / move' },
  { name: 'setuid', detail: 'Privilege change' },
];

export default function HowItWorks() {
  return (
    <div className="container">
      <PageHeader
        eyebrow="How it works"
        title="A kernel instrument, end to end."
        lede="Seven hooks, five-second windows, ten features, one learned baseline. This is the full path from a syscall to a scored alert."
      />

      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Sections">
          <ol className={styles.railList}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={styles.railLink}>
                  <span className={styles.railNum}>{s.n}</span>
                  <span className={styles.railLabel}>{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.content}>
          <Reveal>
            <section id="syscalls" className={styles.section} aria-labelledby="h-syscalls">
              <p className={styles.index}>01</p>
              <h2 id="h-syscalls" className={styles.sectionTitle}>The seven syscalls</h2>
              <p className={styles.body}>
                The collector hooks exactly seven syscalls inside the kernel. This is a deliberate
                small surface: broad enough to describe most attack primitives, cheap enough to run
                at line rate. Everything Sentinel knows about a process comes from these seven.
              </p>
              <ul className={styles.syscalls}>
                {SYSCALLS.map((s) => (
                  <li key={s.name} className={styles.syscall}>
                    <code className={styles.syscallName}>{s.name}()</code>
                    <span className={styles.syscallDetail}>{s.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section id="windowing" className={styles.section} aria-labelledby="h-windowing">
              <p className={styles.index}>02</p>
              <h2 id="h-windowing" className={styles.sectionTitle}>Windowing</h2>
              <p className={styles.body}>
                Raw events are grouped into fixed 5-second buckets keyed by{' '}
                <code className={styles.inline}>pid + process_start_time_ns</code>. The start time
                is in the key because the kernel recycles pids — a new process reusing an old pid
                must not inherit the old process’s history.
              </p>
              <p className={styles.body}>
                Child spawns are handled separately. Fork is not one of the seven hooks, so a
                parallel ppid → child index is maintained and merged into the parent’s vector at
                flush time. A window that goes quiet is still scored by a background reaper.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section id="features" className={styles.section} aria-labelledby="h-features">
              <p className={styles.index}>03</p>
              <h2 id="h-features" className={styles.sectionTitle}>Feature vector</h2>
              <p className={styles.body}>
                Each flushed window becomes a 10-dimensional vector. The column order is fixed and
                shared end-to-end: it is the model input, the SQLite column set, and the API
                schema. Ten features in this exact order.
              </p>
              <ol className={styles.features}>
                {FEATURES.map((f, i) => (
                  <li key={f.key} className={styles.feature}>
                    <span className={styles.featureIdx}>{String(i + 1).padStart(2, '0')}</span>
                    <code className={styles.featureKey}>{f.key}</code>
                    <span className={styles.featureLabel}>{f.label}</span>
                  </li>
                ))}
              </ol>
            </section>
          </Reveal>

          <Reveal>
            <section id="scoring" className={styles.section} aria-labelledby="h-scoring">
              <p className={styles.index}>04</p>
              <h2 id="h-scoring" className={styles.sectionTitle}>Scoring</h2>
              <p className={styles.body}>
                An Isolation Forest is fitted offline on a baseline CSV of feature vectors, then
                scores every new window against that learned distribution. It is unsupervised —
                there is no labeled training set.
              </p>
              <p className={styles.body}>
                sklearn’s sign convention is preserved end to end and must never be inverted.
              </p>
              <CodeBlock title="score convention">
{`decision_function(x) < 0  →  anomaly
predict(x) == -1          →  anomaly
is_anomalous              →  authoritative flag

# an alerting threshold sits just below 0, e.g. -0.05`}
              </CodeBlock>
            </section>
          </Reveal>

          <Reveal>
            <section id="explain" className={styles.section} aria-labelledby="h-explain">
              <p className={styles.index}>05</p>
              <h2 id="h-explain" className={styles.sectionTitle}>Explainability</h2>
              <p className={styles.body}>
                Every scored window carries per-feature z-scores against the baseline mean and
                standard deviation. A feature is a high contributor when |z| &gt; 1.5, and high
                severity when |z| &gt; 3. This is what turns “anomaly −0.31” into “process made
                1,400 file renames in five seconds.”
              </p>
              <CodeBlock title="contributor severity">
{`abs(z) > 3.0   → high
abs(z) > 1.5   → medium
else           → low`}
              </CodeBlock>
            </section>
          </Reveal>

          <Reveal>
            <section id="retention" className={styles.section} aria-labelledby="h-retention">
              <p className={styles.index}>06</p>
              <h2 id="h-retention" className={styles.sectionTitle}>Retention</h2>
              <p className={styles.body}>
                A background loop prunes records older than 24 hours, so the SQLite store stays
                bounded and the console stays a snapshot of recent behavior rather than a growing
                archive. This is why “24h retention” appears throughout the UI.
              </p>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
