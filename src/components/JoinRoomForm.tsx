'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { joinRoomByCode } from '@/lib/rooms';
import { Button } from './Button';
import styles from './JoinRoomForm.module.css';

export function JoinRoomForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinRoomByCode(code);
      router.push(`/rooms/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that room');
      setBusy(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={onSubmit}>
      <label htmlFor="room-code" className={styles.label}>Room code</label>
      <input
        id="room-code" className={styles.input} value={code} placeholder="e.g. K7QM2X" maxLength={6}
        autoCapitalize="characters" autoComplete="off" spellCheck={false}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <Button full type="submit">{busy ? 'Joining…' : 'Join Room'}</Button>
    </form>
  );
}
