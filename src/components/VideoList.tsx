'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { listLibrary, setSaved, startWatchParty, type LibraryVideo } from '@/lib/library';
import { Button } from './Button';
import { VideoCard } from './VideoCard';
import styles from './VideoList.module.css';

export function VideoList({ mode, limit }: { mode: 'library' | 'saved'; limit?: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<LibraryVideo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setVideos(await listLibrary(user.id, { savedOnly: mode === 'saved', limit }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load videos');
    }
  }, [user, mode, limit]);

  useEffect(() => { load(); }, [load]);

  async function toggle(v: LibraryVideo) {
    setVideos((list) => (list ?? []).map((x) => (x.id === v.id ? { ...x, saved: !x.saved } : x)));
    try {
      await setSaved(v.id, !v.saved);
      if (mode === 'saved' && v.saved) setVideos((list) => (list ?? []).filter((x) => x.id !== v.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update saved');
      load();
    }
  }

  async function watch(v: LibraryVideo) {
    setBusy(v.id);
    setError(null);
    try {
      router.push(`/rooms/${await startWatchParty(v.id)}/watch`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a room');
      setBusy(null);
    }
  }

  if (error && videos === null) return <p role="alert" className={styles.error}>{error}</p>;
  if (videos === null) return <p className={styles.muted}>Loading…</p>;

  if (videos.length === 0) {
    return mode === 'saved' ? (
      <div className={styles.empty}>
        <BookOpen size={96} strokeWidth={1.1} color="var(--accent)" />
        <p className={styles.strong}>No saved content yet</p>
        <p className={styles.muted}>Save movies to watch later with friends.</p>
        <Button href="/explore">Explore Content</Button>
      </div>
    ) : (
      <div className={styles.empty}>
        <BookOpen size={72} strokeWidth={1.1} color="var(--accent)" />
        <p className={styles.strong}>No videos yet</p>
        <p className={styles.muted}>Create a room, upload a video, and share it to the library. It will show up here for everyone.</p>
        <Link href="/rooms" className={styles.link}>Go to Rooms</Link>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} mine={v.owner_id === user?.id} busy={busy === v.id} onWatch={() => watch(v)} onToggleSave={() => toggle(v)} />
      ))}
    </div>
  );
}
