import { useSentinel } from '@/context/SentinelContext';
import styles from './DemoBadge.module.css';

/** Shown when no backend is configured — every metric is simulated. */
export function DemoBadge() {
  const { demoMode } = useSentinel();
  if (!demoMode) return null;
  return (
    <span className={styles.badge} role="note">
      SIMULATED DATA
    </span>
  );
}
