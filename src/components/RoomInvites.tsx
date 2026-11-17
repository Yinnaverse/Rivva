'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { acceptInvite, dismissInvite, listInvites, type Invite } from '@/lib/friends';
import { supabase } from '@/lib/supabase';
import styles from './RoomInvites.module.css';

export function RoomInvites() {
  const { user } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.is_anonymous) return;
    try { setInvites(await listInvites()); } catch { /* invites are optional; stay quiet */ }
  }, [user]);

  useEffect(() => {
    load();
    if (!user || user.is_anonymous) return;
    const ch = supabase.channel(`invites:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_invites' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  async function join(i: Invite) {
    setError(null);
    try { router.push(`/rooms/${await acceptInvite(i.id)}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not join'); load(); }
  }

  async function dismiss(i: Invite) {
    setInvites((list) => list.filter((x) => x.id !== i.id));
    try { await dismissInvite(i.id); } catch { load(); }
  }

  if (invites.length === 0) return null;
  return (
    <section className={styles.wrap} aria-label="Room invites">
      {invites.map((i) => (
        <div key={i.id} className={styles.invite}>
          <Mail size={22} color="var(--accent)" />
          <div className={styles.text}>
            <strong>{i.inviter?.display_name ?? 'A friend'}</strong> invited you to <strong>{i.room_name}</strong>
          </div>
          <button className={styles.join} onClick={() => join(i)}>Join</button>
          <button className={styles.no} onClick={() => dismiss(i)} aria-label="Dismiss invite">✕</button>
        </div>
      ))}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
