'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Film, Link2, Share2, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { SUBTITLE_LANGUAGES } from '@/lib/subtitles';
import { supabase } from '@/lib/supabase';
import type { Video } from '@/lib/types';
import {
  addSubtitle, addVideoLink, chooseForRoom, deleteVideo, formatClock, listVideos, setShared, uploadVideo,
} from '@/lib/videos';
import { Button } from '../Button';
import styles from './ContentPicker.module.css';

type Tab = 'streaming' | 'upload' | 'shared';
const TABS: { id: Tab; label: string }[] = [
  { id: 'streaming', label: 'Streaming service' },
  { id: 'upload', label: 'Upload Files' },
  { id: 'shared', label: 'Shared Library' },
];

export function ContentPicker({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upload');
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subLang, setSubLang] = useState('en');
  const [url, setUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setVideos(await listVideos()); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load videos'); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('rooms').select('host_id').eq('id', roomId).maybeSingle();
      setIsHost(Boolean(data && user && data.host_id === user.id));
    })();
    load();
  }, [roomId, user, load]);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f.name)) {
      setError('Please choose a video file.');
      return;
    }
    setError(null);
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' ').trim());
  }

  async function watch(video: Video) {
    setBusy(`watch:${video.id}`);
    setError(null);
    try {
      await chooseForRoom(roomId, video.id);
      router.push(`/rooms/${roomId}/watch`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the movie');
      setBusy(null);
    }
  }

  async function onUpload() {
    if (!file) return;
    setBusy('upload');
    setError(null);
    try {
      const video = await uploadVideo(file, title.trim() || file.name);
      if (subFile) {
        const lang = SUBTITLE_LANGUAGES.find((l) => l.code === subLang)!;
        await addSubtitle(video.id, subFile, lang.code, lang.label);
      }
      await watch(video);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setBusy(null);
    }
  }

  async function onLink(e: React.FormEvent) {
    e.preventDefault();
    let parsed: URL;
    try { parsed = new URL(url.trim()); } catch { setError('Paste a full link starting with https://'); return; }
    if (parsed.protocol !== 'https:') { setError('Only https:// links work.'); return; }
    setBusy('link');
    setError(null);
    try {
      const name = decodeURIComponent(parsed.pathname.split('/').pop() || 'Shared video').replace(/\.[^.]+$/, '');
      await watch(await addVideoLink(parsed.toString(), name || 'Shared video'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that link');
      setBusy(null);
    }
  }

  async function toggleShare(v: Video) {
    try { await setShared(v.id, !v.is_shared); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update'); }
  }

  async function remove(v: Video) {
    if (!confirm(`Delete “${v.title}”?`)) return;
    try { await deleteVideo(v); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete'); }
  }

  if (isHost === false) {
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Choose Content</h1>
        <p className={styles.muted}>Only the host can choose what to watch.</p>
        <Button href={`/rooms/${roomId}`}>Back to the lobby</Button>
      </div>
    );
  }

  const mine = videos.filter((v) => v.owner_id === user?.id);
  const shared = videos.filter((v) => v.is_shared);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>Choose Content</h1>
          <p className={styles.muted}>Select what to watch in room</p>
        </div>
        <Link href={`/rooms/${roomId}`} aria-label="Close" className={styles.close}><X size={28} /></Link>
      </header>

      <div role="tablist" className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      {tab === 'streaming' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}><Film size={22} /> Streaming service</h2>
          <p className={styles.muted}>
            Netflix, Prime Video and similar apps don’t allow their video to be played inside another app, so they can’t be synced here.
            Upload a file you own, or paste a link to one, and everyone watches it together.
          </p>
          <Button onClick={() => setTab('upload')}>Upload a file</Button>
        </section>
      )}

      {tab === 'upload' && (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}><Upload size={22} /> Upload Your Own Files</h2>
            <div
              className={`${styles.drop} ${dragging ? styles.dropOn : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
            >
              <Upload size={64} strokeWidth={1.5} />
              {file ? (
                <p className={styles.strong}>{file.name} <span className={styles.muted}>({(file.size / 1048576).toFixed(1)} MB)</span></p>
              ) : (
                <>
                  <p className={styles.strong}>Drag and drop your video files</p>
                  <p className={styles.muted}>Supports MP4, WebM and MOV</p>
                </>
              )}
              <button type="button" className={styles.chooseBtn} onClick={() => fileInput.current?.click()}>
                {file ? 'Choose another' : 'Choose Files'}
              </button>
              <input ref={fileInput} type="file" accept="video/*,.mp4,.webm,.mov,.m4v" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </div>

            {file && (
              <div className={styles.form}>
                <label htmlFor="v-title" className={styles.label}>Title</label>
                <input id="v-title" className={styles.input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
                <label htmlFor="v-sub" className={styles.label}>Subtitles <span className={styles.muted}>(optional, .srt or .vtt)</span></label>
                <div className={styles.row}>
                  <select className={styles.input} value={subLang} onChange={(e) => setSubLang(e.target.value)} aria-label="Subtitle language">
                    {SUBTITLE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                  <input id="v-sub" className={styles.input} type="file" accept=".srt,.vtt" onChange={(e) => setSubFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button full onClick={onUpload}>{busy === 'upload' || busy?.startsWith('watch') ? 'Uploading… keep this page open' : 'Upload & Start watching'}</Button>
              </div>
            )}

            <div className={styles.or}><span /><em>OR</em><span /></div>
            <form className={styles.linkRow} onSubmit={onLink}>
              <input className={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste video URL" aria-label="Video URL" inputMode="url" />
              <button type="submit" className={styles.linkBtn} aria-label="Use this link" disabled={!url.trim() || busy === 'link'}><Link2 size={22} /></button>
            </form>
            <p className={styles.hint}>Links must be a direct https:// link to an MP4 or WebM file.</p>
          </section>

          {mine.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Your uploads</h2>
              {mine.map((v) => (
                <div key={v.id} className={styles.item}>
                  <div className={styles.itemBody}>
                    <span className={styles.strong}>{v.title}</span>
                    <span className={styles.muted}>{v.duration_seconds ? formatClock(v.duration_seconds) : v.source_url ? 'Link' : 'Video'}</span>
                  </div>
                  <button className={styles.iconBtn} onClick={() => toggleShare(v)} aria-pressed={v.is_shared} aria-label={v.is_shared ? 'Stop sharing' : 'Share to library'} title={v.is_shared ? 'Shared with everyone' : 'Share to library'}>
                    <Share2 size={20} color={v.is_shared ? 'var(--accent)' : 'currentColor'} />
                  </button>
                  <button className={styles.iconBtn} onClick={() => remove(v)} aria-label={`Delete ${v.title}`}><Trash2 size={20} /></button>
                  <button className={styles.watchBtn} onClick={() => watch(v)} disabled={busy !== null}>{busy === `watch:${v.id}` ? '…' : 'Watch'}</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'shared' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Shared Library</h2>
          {shared.length === 0 ? (
            <div className={styles.empty}>
              <BookOpen size={72} strokeWidth={1.2} color="var(--accent)" />
              <p className={styles.strong}>No shared content yet</p>
              <p className={styles.muted}>Upload a file and share it to build your shared library.</p>
              <Button onClick={() => setTab('upload')}>Upload a file</Button>
            </div>
          ) : (
            shared.map((v) => (
              <div key={v.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <span className={styles.strong}>{v.title}</span>
                  <span className={styles.muted}>{v.duration_seconds ? formatClock(v.duration_seconds) : 'Video'}</span>
                </div>
                <button className={styles.watchBtn} onClick={() => watch(v)} disabled={busy !== null}>{busy === `watch:${v.id}` ? '…' : 'Select & Watch'}</button>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
