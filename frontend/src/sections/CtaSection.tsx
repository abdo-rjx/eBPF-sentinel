import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import styles from './CtaSection.module.css';

export function CtaSection() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal>
          <div className={styles.band}>
            <p className={styles.eyebrow}>RUN THE PIPELINE</p>
            <h2 className={styles.title}>Put a collector on a host you care about.</h2>
            <p className={styles.body}>
              The console works with zero setup in demo mode. With a backend and the eBPF collector
              running, it shows the real kernel stream.
            </p>
            <div className={styles.actions}>
              <ButtonLink to="/dashboard" variant="primary" size="lg">
                Open live console
              </ButtonLink>
              <ButtonLink to="/how-it-works" variant="ghost" size="lg">
                Read the docs
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
