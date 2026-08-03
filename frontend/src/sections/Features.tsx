import { Activity, Cpu, Database, Radio, Server, Target } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import styles from './Features.module.css';

const FEATURES = [
  {
    icon: Activity,
    title: 'Behavioral, not signature-based',
    body: 'No hash lists, no IOCs to update. Anything that acts differently from its own baseline gets flagged.',
  },
  {
    icon: Cpu,
    title: 'Unsupervised by design',
    body: 'The Isolation Forest learns your host’s normal from raw behavior — no labeled training set required to ship.',
  },
  {
    icon: Target,
    title: 'Explainable alerts',
    body: 'Every anomaly carries per-feature z-scores, so an analyst sees why a process deviated — not just a red dot.',
  },
  {
    icon: Radio,
    title: 'Live by default',
    body: 'Scored windows stream over SSE the moment they are written. The console updates without a refresh.',
  },
  {
    icon: Database,
    title: 'Bounded storage',
    body: '24-hour retention keeps the SQLite store finite. Old windows are pruned, never grown forever.',
  },
  {
    icon: Server,
    title: 'One host, deep',
    body: 'Per-host visibility with full pid and syscall accounting — a focused instrument rather than a fleet dashboard.',
  },
];

export function Features() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal>
          <div className={styles.head}>
            <p className="label">Why it holds up</p>
            <h2 className={styles.title}>An instrument, not a black box.</h2>
          </div>
        </Reveal>

        <div className={styles.grid}>
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 0.07} className={styles.cardWrap}>
              <article className={styles.card}>
                <feature.icon className={styles.icon} size={20} strokeWidth={1.75} aria-hidden="true" />
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardBody}>{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
