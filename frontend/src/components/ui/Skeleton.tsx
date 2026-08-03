import styles from './Skeleton.module.css';

interface SkeletonProps {
  className?: string;
}

/** Static placeholder blocks — no shimmer animation, matches the flat design. */
export function Skeleton({ className }: SkeletonProps) {
  return <span className={`${styles.skeleton} ${className ?? ''}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className={styles.page} role="status" aria-label="Loading">
      <div className={styles.row}>
        <Skeleton className={styles.badge} />
        <Skeleton className={styles.badge} />
        <Skeleton className={styles.badge} />
        <Skeleton className={styles.badge} />
      </div>
      <Skeleton className={styles.block} />
      <Skeleton className={styles.block} />
    </div>
  );
}
