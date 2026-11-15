'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Heart, Home, Settings, Tv } from 'lucide-react';
import styles from './BottomNav.module.css';

const items = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/explore', label: 'Explore', Icon: Compass },
  { href: '/rooms', label: 'Rooms', Icon: Tv },
  { href: '/saved', label: 'Saved', Icon: Heart },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary">
      {items.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`${styles.item} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon size={24} strokeWidth={active ? 2.2 : 1.6} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
