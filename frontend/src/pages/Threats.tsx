import { PageHeader } from '@/components/layout/PageHeader';
import { ThreatMatrix } from '@/components/threats/ThreatMatrix';
import { SignatureCard } from '@/components/threats/SignatureCard';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Reveal } from '@/components/ui/Reveal';
import { THREATS } from '@/lib/data/threats';
import styles from './Threats.module.css';

export default function Threats() {
  return (
    <div className="container">
      <PageHeader
        eyebrow="Threat intel"
        title="Behavioral fingerprints, not IOC lists."
        lede="Each signature is a recurring shape in feature space — the same deviation pattern an Isolation Forest flags against a clean baseline. Vectors below are normalized 0..1 and hand-authored as illustrations, not measurements."
      />

      <section className={styles.legend} aria-label="Severity key">
        <Reveal>
          <div className={styles.legendRow}>
            <span className="label">Severity key</span>
            <SeverityBadge severity="critical" />
            <SeverityBadge severity="suspicious" />
            <span className={styles.legendNote}>
              Scores are negative for anomalies; is_anomalous is authoritative.
            </span>
          </div>
        </Reveal>
      </section>

      <Reveal>
        <h2 className={styles.sectionTitle}>Matrix</h2>
      </Reveal>
      <ThreatMatrix />

      <Reveal>
        <h2 className={styles.sectionTitle}>Signatures</h2>
      </Reveal>
      <div className={styles.cards}>
        {THREATS.map((t, i) => (
          <Reveal key={t.id} delay={(i % 2) * 0.06}>
            <SignatureCard threat={t} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
