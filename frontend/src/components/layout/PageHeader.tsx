import { Reveal } from '@/components/ui/Reveal';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  lede?: string;
}

export function PageHeader({ eyebrow, title, lede }: PageHeaderProps) {
  return (
    <Reveal>
      <header className={styles.header}>
        <p className="label">{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </header>
    </Reveal>
  );
}
