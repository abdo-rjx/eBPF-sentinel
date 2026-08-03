import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  title?: string;
  children: string;
}

export function CodeBlock({ title, children }: CodeBlockProps) {
  return (
    <figure className={styles.block}>
      {title && <figcaption className={styles.title}>{title}</figcaption>}
      <pre className={styles.pre}>
        <code>{children}</code>
      </pre>
    </figure>
  );
}
