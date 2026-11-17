'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthProvider';
import { sendFriendRequest } from '@/lib/friends';
import { Button } from './Button';

export function AddFriend({ username }: { username: string }) {
  const { user } = useAuth();
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    if (user.is_anonymous) { setResult({ kind: 'error', text: 'Sign up for an account first, then open this link again.' }); return; }
    sendFriendRequest(username)
      .then((r) => setResult({ kind: 'ok', text: r === 'accepted' ? `You and @${username} are now friends.` : `Friend request sent to @${username}.` }))
      .catch((e) => setResult({ kind: 'error', text: e instanceof Error ? e.message : 'Could not send the request' }));
  }, [user, username]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 500 }}>Add @{username}</h1>
      <p role={result?.kind === 'error' ? 'alert' : 'status'} style={{ color: result?.kind === 'error' ? '#ff6b7d' : 'var(--muted)' }}>
        {result ? result.text : 'Sending your request…'}
      </p>
      <Button href="/settings">Go to Friends</Button>
      <Link href="/" style={{ color: 'var(--muted)' }}>Back home</Link>
    </section>
  );
}
