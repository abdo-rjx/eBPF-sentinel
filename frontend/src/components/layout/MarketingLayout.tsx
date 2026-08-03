import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Footer } from '@/components/layout/Footer';
import { SkipLink } from '@/components/layout/SkipLink';
import { ScrollProgress } from '@/components/layout/ScrollProgress';
import styles from './MarketingLayout.module.css';

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export function MarketingLayout() {
  const location = useLocation();
  return (
    <div className={styles.wrap}>
      <SkipLink />
      <SiteHeader />
      <ScrollProgress />
      <main id="main" className={styles.main}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} {...pageTransition} className={styles.page}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
