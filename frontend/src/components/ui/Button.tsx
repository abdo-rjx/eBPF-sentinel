import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={`${styles.btn} ${styles.link} ${styles[variant]} ${styles[size]} ${className ?? ''}`}
    >
      {children}
    </Link>
  );
}
