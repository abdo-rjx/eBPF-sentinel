import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import styles from './Footer.module.css';

const COLUMNS: Array<{ heading: string; links: Array<{ to: string; label: string }> }> = [
  {
    heading: 'Product',
    links: [
      { to: '/dashboard', label: 'Live console' },
      { to: '/how-it-works', label: 'How it works' },
      { to: '/threats', label: 'Threat intel' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { to: '/about', label: 'About' },
      { to: '/', label: 'Overview' },
    ],
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} container`}>
        <div className={styles.brandCol}>
          <Logo to="/" />
          <p className={styles.tagline}>
            Kernel-level behavioral detection. Seven syscalls hooked in eBPF, five-second
            windows, Isolation Forest scoring.
          </p>
          <p className={styles.stack}>
            COLLECTOR·eBPF / BACKEND·FastAPI / MODEL·IsolationForest / UI·React
          </p>
        </div>

        <div className={styles.columns}>
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className={styles.heading}>{col.heading}</h3>
              <ul className={styles.list}>
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={styles.link}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={`${styles.bottomInner} container`}>
          <span className={styles.print}>SENTINEL — KERNEL BEHAVIORAL EDR</span>
          <span className={styles.print}>
            {import.meta.env.DEV ? 'DEV BUILD' : 'BUILD'} · 7 SYSCALLS · 5S WINDOWS
          </span>
        </div>
      </div>
    </footer>
  );
}
