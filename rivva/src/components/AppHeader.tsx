import { Menu } from 'lucide-react';
import { Logo } from './Logo';
import styles from './AppHeader.module.css';

export function AppHeader() {
  return (
    <header className={styles.header}>
      <Logo />
      <button type="button" aria-label="Menu" className={styles.menu}>
        <Menu size={28} />
      </button>
    </header>
  );
}
