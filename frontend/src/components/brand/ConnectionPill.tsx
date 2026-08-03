import { useSentinel } from '@/context/SentinelContext';
import type { ConnectionState } from '@/types';
import styles from './ConnectionPill.module.css';

const LABELS: Record<ConnectionState, string> = {
  connecting: 'CONNECTING',
  connected: 'LIVE',
  reconnecting: 'RECONNECTING',
  demo_mode: 'DEMO MODE',
};

export function ConnectionPill() {
  const { mode } = useSentinel();
  return (
    <span className={`${styles.pill} ${styles[mode]}`} role="status" title={mode}>
      <span className={styles.glyph} aria-hidden="true" />
      {LABELS[mode]}
    </span>
  );
}
