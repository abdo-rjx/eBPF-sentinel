import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'accent' | 'danger';
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
