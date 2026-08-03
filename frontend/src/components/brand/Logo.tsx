import { Link } from 'react-router-dom';
import styles from './Logo.module.css';

interface LogoMarkProps {
  size?: number;
}

/** Sentinel mark: monitor frame + orbit ring/node + the anomaly needle. */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={styles.mark}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="28" height="28" rx="4" fill="var(--bg-0)" />
      <rect x="2" y="2" width="28" height="28" rx="4" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <g transform="rotate(-24 16 16)">
        <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent)" strokeOpacity="0.65" strokeWidth="1.5" />
        <circle cx="24" cy="11" r="1.8" fill="var(--accent)" />
      </g>
      <path d="M16 20 V12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface LogoProps {
  to?: string;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ to, showWordmark = true, className }: LogoProps) {
  const content = (
    <>
      <LogoMark />
      {showWordmark && <span className={styles.wordmark}>SENTINEL</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${styles.logo} ${className ?? ''}`} aria-label="Sentinel — home">
        {content}
      </Link>
    );
  }
  return <div className={`${styles.logo} ${className ?? ''}`}>{content}</div>;
}
