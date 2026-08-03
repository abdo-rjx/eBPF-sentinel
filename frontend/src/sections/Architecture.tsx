import { Reveal } from '@/components/ui/Reveal';
import styles from './Architecture.module.css';

const STAGES = [
  { index: '01', name: 'Collector', detail: 'eBPF · 7 syscalls', note: 'root, on the host' },
  { index: '02', name: 'Windowing', detail: '5s buckets', note: 'keyed (pid, start)' },
  { index: '03', name: 'Feature vector', detail: '10 features', note: 'per process' },
  { index: '04', name: 'Isolation Forest', detail: 'unsupervised', note: 'learned baseline' },
  { index: '05', name: 'REST + SSE', detail: 'SQLite · live', note: 'streamed to UI' },
];

export function Architecture() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal>
          <div className={styles.head}>
            <p className="label">Pipeline</p>
            <h2 className={styles.title}>Kernel to console in five stages.</h2>
          </div>
        </Reveal>

        <ol className={styles.stages}>
          {STAGES.map((stage, i) => (
            <Reveal key={stage.index} delay={i * 0.07} className={styles.stageWrap}>
              <li className={styles.stage}>
                <span className={styles.index}>{stage.index}</span>
                <h3 className={styles.name}>{stage.name}</h3>
                <p className={styles.detail}>{stage.detail}</p>
                <p className={styles.note}>{stage.note}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
