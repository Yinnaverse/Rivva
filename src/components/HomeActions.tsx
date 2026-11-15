'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { createRoom } from '@/lib/rooms';
import { Button } from './Button';
import styles from './HomeActions.module.css';

export function HomeActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
      router.push(`/rooms/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a room');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.actions}>
        <Button onClick={onCreate}>{busy ? 'Creating…' : 'Create Room'} <Play size={22} fill="currentColor" /></Button>
        <Button href="/rooms/join" variant="outline">Join Room <Play size={22} fill="currentColor" /></Button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </>
  );
}
