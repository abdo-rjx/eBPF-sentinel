import { Reveal } from '@/components/ui/Reveal';
import styles from './DetectionModel.module.css';

const STEPS = [
  {
    n: '01',
    title: 'Hook',
    body: 'An eBPF collector in the kernel intercepts execve, connect, accept, openat, unlink, rename, and setuid — raw behavior, no agents in userland.',
  },
  {
    n: '02',
    title: 'Score',
    body: 'Every process becomes a 10-feature vector each 5-second window. An Isolation Forest compares it against a learned baseline and emits an anomaly score.',
  },
  {
    n: '03',
    title: 'Alert',
    body: 'Scored windows stream to the console in real time. Negative scores flag deviation, and per-feature z-scores explain exactly which behavior triggered it.',
  },
];

export function DetectionModel() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal>
          <div className={styles.head}>
            <p className="label">Detection model</p>
            <h2 className={styles.title}>Hook → score → alert.</h2>
            <p className={styles.lede}>
              The whole pipeline is three moves. Nothing runs in userland; the kernel does the watching.
            </p>
          </div>
        </Reveal>

        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.08} className={styles.stepWrap}>
              <li className={styles.step}>
                <span className={styles.index}>{step.n}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
