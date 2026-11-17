'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Compass, Heart, Home, LogIn, LogOut, Menu, Settings, Tv, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { useNotifications } from '@/lib/NotificationsProvider';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import styles from './AppHeader.module.css';

const LINKS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/explore', label: 'Explore', Icon: Compass },
  { href: '/rooms', label: 'Rooms', Icon: Tv },
  { href: '/saved', label: 'Saved', Icon: Heart },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function AppHeader() {
  const { user, displayName, signOut } = useAuth();
  const { unread } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function logout() {
    setOpen(false);
    await signOut();
    router.replace('/login');
  }

  return (
    <>
      <header className={styles.header}>
        <Link href="/" aria-label="Rivva home"><Logo /></Link>
        <div className={styles.actions}>
          <Link href="/notifications" className={styles.iconBtn} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
            <Bell size={26} />
            {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <button type="button" className={styles.iconBtn} aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={28} />
          </button>
        </div>
      </header>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <nav className={styles.drawer} role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <div className={styles.who}>
                <Avatar name={displayName} size={40} />
                <div><strong>{displayName}</strong><span>{user?.is_anonymous ? 'Guest account' : user?.email}</span></div>
              </div>
              <button type="button" className={styles.iconBtn} aria-label="Close menu" onClick={() => setOpen(false)}><X size={26} /></button>
            </div>
            <ul className={styles.links}>
              {LINKS.map(({ href, label, Icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link href={href} className={`${styles.link} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}><Icon size={22} /> {label}</Link>
                  </li>
                );
              })}
              <li>
                <Link href="/notifications" className={styles.link}>
                  <Bell size={22} /> Notifications {unread > 0 && <span className={styles.count}>{unread}</span>}
                </Link>
              </li>
              <li><Link href="/rooms/join" className={styles.link}><LogIn size={22} /> Join a room with a code</Link></li>
            </ul>
            <button type="button" className={styles.logout} onClick={logout}><LogOut size={22} /> Logout</button>
          </nav>
        </div>
      )}
    </>
  );
}
