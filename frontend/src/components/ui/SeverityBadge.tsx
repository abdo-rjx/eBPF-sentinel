import { SEVERITY_LABEL } from '@/lib/severity';
import type { Severity } from '@/types';
import styles from './SeverityBadge.module.css';

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`${styles.badge} ${styles[severity]}`}>{SEVERITY_LABEL[severity]}</span>
  );
}
