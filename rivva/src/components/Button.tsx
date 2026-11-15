import Link from 'next/link';
import styles from './Button.module.css';

type Props = {
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  href?: string;
  onClick?: () => void;
  full?: boolean;
  type?: 'button' | 'submit';
};

export function Button({ children, variant = 'primary', href, onClick, full, type = 'button' }: Props) {
  const cls = `${styles.btn} ${styles[variant]} ${full ? styles.full : ''}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} className={cls} onClick={onClick}>{children}</button>;
}
