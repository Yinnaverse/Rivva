'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { joinRoom, listRooms } from '@/lib/rooms';
import { supabase } from '@/lib/supabase';
import type { RoomListItem } from '@/lib/types';
import { RoomCard } from './RoomCard';
import styles from './RoomList.module.css';

export function RoomList({ title, only }: { title: string; only?: 'mine' }) {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRooms(await listRooms());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rooms');
    }
  }, []);

  useEffect(() => {
    load();
    // Keep the list fresh as rooms and members change.
    const ch = supabase
      .channel('room-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function open(room: RoomListItem, member: boolean) {
    try {
      if (!member) await joinRoom(room.id);
      router.push(`/rooms/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join that room');
    }
  }

  const isMember = (r: RoomListItem) => r.room_members.some((m) => m.user_id === user?.id);
  const visible = (rooms ?? []).filter((r) => (only === 'mine' ? isMember(r) : true));

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {rooms === null && !error && <p className={styles.empty}>Loading rooms…</p>}
      {rooms !== null && visible.length === 0 && (
        <p className={styles.empty}>
          {only === 'mine' ? 'You haven’t joined any rooms yet. Create one or join with a code.' : 'No rooms yet. Create one to start watching together.'}
        </p>
      )}
      {visible.map((r) => (
        <RoomCard key={r.id} room={r} isMember={isMember(r)} onOpen={() => open(r, isMember(r))} />
      ))}
    </section>
  );
}
