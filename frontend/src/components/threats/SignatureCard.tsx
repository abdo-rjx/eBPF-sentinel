import type { ThreatSignature } from '@/lib/data/threats';
import { FEATURES } from '@/lib/data/threats';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { FeatureRadar } from '@/components/threats/FeatureRadar';
import styles from './SignatureCard.module.css';

interface SignatureCardProps {
  threat: ThreatSignature;
}

export function SignatureCard({ threat }: SignatureCardProps) {
  const spikeLabels = threat.features
    .map((key) => FEATURES.find((f) => f.key === key)?.label)
    .filter((x): x is string => Boolean(x));

  return (
    <article className={styles.card}>
      <div className={styles.radarCol}>
        <FeatureRadar vector={threat.vector} severity={threat.severity} />
        <p className={styles.radarCaption}>FEATURE VECTOR · NORMALIZED</p>
      </div>

      <div className={styles.body}>
        <div className={styles.head}>
          <SeverityBadge severity={threat.severity} />
          <span className={styles.tactics}>{threat.tactics.join(' / ')}</span>
        </div>
        <h3 className={styles.title}>{threat.name}</h3>
        <p className={styles.blurb}>{threat.blurb}</p>

        <div className={styles.meta}>
          <div>
            <p className={styles.metaLabel}>SYSCALLS SEEN</p>
            <div className={styles.syscalls}>
              {threat.syscalls.map((s) => (
                <code key={s} className={styles.syscall}>{s}()</code>
              ))}
            </div>
          </div>
          <div>
            <p className={styles.metaLabel}>SPIKING FEATURES</p>
            <p className={styles.spikes}>{spikeLabels.join(' · ')}</p>
          </div>
        </div>

        <div className={styles.detection}>
          <p className={styles.metaLabel}>HOW SENTINEL SEES IT</p>
          <ul className={styles.howList}>
            {threat.howDetected.map((h) => (
              <li key={h} className={styles.howItem}>{h}</li>
            ))}
          </ul>
          <p className={styles.windowNote}>{threat.windowNote}</p>
        </div>
      </div>
    </article>
  );
}
