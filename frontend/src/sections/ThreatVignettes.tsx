import { Link } from 'react-router-dom';
import { THREATS } from '@/lib/data/threats';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Reveal } from '@/components/ui/Reveal';
import styles from './ThreatVignettes.module.css';

const VIGNETTES = ['ransomware', 'c2-beacon', 'setuid-privesc'] as const;

export function ThreatVignettes() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal>
          <div className={styles.head}>
            <p className="label">What it catches</p>
            <h2 className={styles.title}>Three attacks, one baseline.</h2>
            <p className={styles.lede}>
              These signatures were not written by hand — they fall out of a process behaving
              differently from its peers.
            </p>
          </div>
        </Reveal>

        <div className={styles.grid}>
          {VIGNETTES.map((id, i) => {
            const t = THREATS.find((x) => x.id === id);
            if (!t) return null;
            return (
              <Reveal key={t.id} delay={i * 0.08} className={styles.cardWrap}>
                <article className={styles.card}>
                  <div className={styles.cardHead}>
                    <SeverityBadge severity={t.severity} />
                    <span className={styles.cardIndex}>0{i + 1}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{t.name}</h3>
                  <p className={styles.cardBody}>{t.blurb}</p>
                  <div className={styles.syscalls}>
                    {t.syscalls.map((s) => (
                      <code key={s} className={styles.syscall}>{s}()</code>
                    ))}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className={styles.more}>
          <Link to="/threats" className={styles.moreLink}>
            Full threat matrix →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
