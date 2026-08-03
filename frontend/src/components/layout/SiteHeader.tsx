import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ConnectionPill } from '@/components/brand/ConnectionPill';
import { DemoBadge } from '@/components/brand/DemoBadge';
import { ButtonLink } from '@/components/ui/Button';
import { MobileNav } from '@/components/layout/MobileNav';
import styles from './SiteHeader.module.css';

export const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/threats', label: 'Threat intel' },
  { to: '/about', label: 'About' },
];

interface SiteHeaderProps {
  variant?: 'marketing' | 'console';
}

export function SiteHeader({ variant = 'marketing' }: SiteHeaderProps) {
  const isConsole = variant === 'console';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`${styles.header} ${isConsole ? styles.consoleHeader : ''}`}>
      <div className={`${styles.inner} ${isConsole ? 'container-wide' : 'container'}`}>
        <Logo to="/" />

        <nav className={styles.nav} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? `${styles.navlink} ${styles.active}` : styles.navlink
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          {isConsole && <DemoBadge />}
          <ConnectionPill />
          {!isConsole && (
            <ButtonLink to="/dashboard" variant="primary" size="sm" className={styles.cta}>
              Open console
            </ButtonLink>
          )}
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Menu size={18} strokeWidth={2} />
          </button>
        </div>

        <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    </header>
  );
}
