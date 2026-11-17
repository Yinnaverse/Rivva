'use client';

import { useRouter } from 'next/navigation';
import { Bell, Mail, Play, UserCheck, UserPlus } from 'lucide-react';
import { useNotifications } from '@/lib/NotificationsProvider';
import type { NotificationKind } from '@/lib/notifications';
import { timeAgo } from '@/lib/time';
import styles from './NotificationsView.module.css';

const ICONS: Record<NotificationKind, typeof Bell> = { friend_request: UserPlus, friend_accepted: UserCheck, room_invite: Mail, movie_started: Play };

export function NotificationsView() {
  const { items, unread, read, readAll } = useNotifications();
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Notifications</h1>
        {unread > 0 && <button className={styles.markAll} onClick={readAll}>Mark all as read</button>}
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <Bell size={64} strokeWidth={1.2} color="var(--accent)" />
          <p><strong>Nothing yet</strong></p>
          <p className={styles.muted}>Friend requests, room invites and movie starts will show up here.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <button className={`${styles.item} ${n.read_at ? '' : styles.unread}`} onClick={() => { read(n.id); if (n.link) router.push(n.link); }}>
                  <span className={styles.icon}><Icon size={20} /></span>
                  <span className={styles.text}>
                    <span className={styles.title}>{n.title}</span>
                    {n.body && <span className={styles.muted}>{n.body}</span>}
                    <span className={styles.time}>{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className={styles.dot} aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
