import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useKeyPress } from '@/hooks/useKeyPress';
import styles from './MobileNav.module.css';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/threats', label: 'Threat intel' },
  { to: '/about', label: 'About' },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref);
  useKeyPress('Escape', onClose, open);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={ref}
        id="mobile-nav"
        className={styles.menu}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className="label">Navigate</span>
          <button type="button" className={styles.close} aria-label="Close menu" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <nav aria-label="Mobile">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
