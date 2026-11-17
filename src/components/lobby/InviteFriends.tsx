'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { inviteFriend, listFriendships, otherPerson, type Person } from '@/lib/friends';
import { Avatar } from '../Avatar';
import styles from './InviteFriends.module.css';

export function InviteFriends({ roomId, memberIds }: { roomId: string; memberIds: string[] }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.is_anonymous) return;
    listFriendships()
      .then((rows) => setFriends(rows.filter((r) => r.status === 'accepted').map((r) => otherPerson(r, user.id)).filter((p): p is Person => Boolean(p))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load friends'));
  }, [user]);

  if (!user) return null;

  async function invite(p: Person) {
    setError(null);
    try {
      await inviteFriend(roomId, p.id);
      setInvited((s) => new Set(s).add(p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invite');
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}><UserPlus size={24} /><h2>Invite friends</h2></div>
      {user.is_anonymous ? (
        <p className={styles.muted}>Sign up for an account to add friends and invite them. Anyone can still join with the room code.</p>
      ) : friends === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : friends.length === 0 ? (
        <p className={styles.muted}>No friends yet. <Link href="/settings" className={styles.link}>Add some in Settings</Link>, or share the room code.</p>
      ) : (
        friends.map((p) => {
          const inRoom = memberIds.includes(p.id);
          const sent = invited.has(p.id);
          return (
            <div key={p.id} className={styles.person}>
              <Avatar name={p.display_name} size={34} />
              <div className={styles.who}><span>{p.display_name}</span><span className={styles.muted}>@{p.username}</span></div>
              {inRoom ? <span className={styles.muted}>In room</span>
                : sent ? <span className={styles.sent}>Invited</span>
                : <button className={styles.btn} onClick={() => invite(p)}>Invite</button>}
            </div>
          );
        })
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
