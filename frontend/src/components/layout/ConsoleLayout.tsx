import { Outlet, ScrollRestoration } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SkipLink } from '@/components/layout/SkipLink';
import styles from './ConsoleLayout.module.css';

export function ConsoleLayout() {
  return (
    <div className={styles.wrap}>
      <SkipLink />
      <SiteHeader variant="console" />
      <main id="main" className={styles.main}>
        <div className="container-wide">
          <Outlet />
        </div>
      </main>
      <footer className={styles.footer}>
        <span className={styles.print}>SENTINEL · LIVE CONSOLE · 5S WINDOWS</span>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
