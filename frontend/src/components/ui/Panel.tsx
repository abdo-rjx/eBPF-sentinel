import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title?: ReactNode;
  /** Right-aligned meta slot in the panel header (e.g. live badge). */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, meta, className, children }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`}>
      {(title || meta) && (
        <header className={styles.head}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {meta && <div className={styles.meta}>{meta}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
