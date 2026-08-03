import { LogoMark } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';
import styles from './NotFound.module.css';

export default function NotFound() {
  return (
    <section className={styles.wrap}>
      <LogoMark size={52} />
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>No such signal.</h1>
      <p className={styles.body}>
        The route you requested does not exist, was never emitted, or has been pruned by retention.
      </p>
      <div className={styles.actions}>
        <ButtonLink to="/" variant="secondary">
          Back to overview
        </ButtonLink>
        <ButtonLink to="/dashboard" variant="primary">
          Open console
        </ButtonLink>
      </div>
    </section>
  );
}
