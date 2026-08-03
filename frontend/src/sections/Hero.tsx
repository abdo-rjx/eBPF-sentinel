import { ButtonLink } from '@/components/ui/Button';
import { HeroVisual } from '@/sections/HeroVisual';
import styles from './Hero.module.css';

const FACTS = [
  { value: '7', label: 'syscalls hooked' },
  { value: '5s', label: 'scoring windows' },
  { value: '10', label: 'behavioral features' },
];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`${styles.inner} container`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>KERNEL-LEVEL BEHAVIORAL DETECTION</p>
          <h1 className={styles.title}>
            See the <span className={styles.accent}>signal</span> before the breach.
          </h1>
          <p className={styles.sub}>
            Sentinel hooks seven syscalls inside the kernel with eBPF, scores every process
            against a learned baseline every five seconds, and streams anomalies to this console.
            No signatures. No noise.
          </p>
          <div className={styles.cta}>
            <ButtonLink to="/dashboard" variant="primary" size="lg">
              Open live console
            </ButtonLink>
            <ButtonLink to="/how-it-works" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
          <dl className={styles.facts}>
            {FACTS.map((f) => (
              <div key={f.label} className={styles.fact}>
                <dt className={styles.factValue}>{f.value}</dt>
                <dd className={styles.factLabel}>{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.visual}>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
