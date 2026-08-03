import { FEATURES } from '@/lib/data/threats';
import type { Severity } from '@/types';
import styles from './FeatureRadar.module.css';

interface FeatureRadarProps {
  vector: number[];
  severity: Exclude<Severity, 'benign'>;
  className?: string;
}

const ABBREV = ['EXEC', 'CHLD', 'OPEN', 'RENM', 'DEL', 'FILES', 'CONN', 'IP', 'UID', 'RATE'];

const CX = 100;
const CY = 100;
const R = 76;

function point(radius: number, i: number, n: number) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

function polygon(radius: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const p = point(radius, i, n);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

/** Hand-authored 0..1 vector drawn as a 10-axis radar in FEATURE_COLUMNS order. */
export function FeatureRadar({ vector, severity, className }: FeatureRadarProps) {
  const n = FEATURES.length;
  const dataPts = vector.map((v, i) => {
    const p = point(Math.max(0.03, Math.min(1, v)) * R, i, n);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Behavioral vector radar (${severity})`}
      className={`${styles.svg} ${styles[severity]} ${className ?? ''}`}
    >
      {/* axis spokes */}
      {Array.from({ length: n }, (_, i) => {
        const p = point(R, i, n);
        return <line key={`axis-${i}`} className={styles.axis} x1={CX} y1={CY} x2={p.x} y2={p.y} />;
      })}
      {/* reference rings */}
      <polygon className={styles.grid} points={polygon(R * 0.33, n)} />
      <polygon className={styles.grid} points={polygon(R * 0.66, n)} />
      <polygon className={styles.grid} points={polygon(R, n)} />
      {/* data */}
      <polygon className={styles.data} points={dataPts.join(' ')} />
      <polygon className={styles.dataStroke} points={dataPts.join(' ')} />
      {/* labels */}
      {ABBREV.map((label, i) => {
        const p = point(R * 1.18, i, n);
        return (
          <text key={label} className={styles.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
