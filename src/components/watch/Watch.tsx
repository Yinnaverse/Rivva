'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowLeft, MessageCircle, Pause, Play, Settings, SmilePlus, Volume2, VolumeX, Wifi, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { DbRoom, Member, Playback, SubtitleRow, Video } from '@/lib/types';
import { endMovie, formatClock, getSubtitleUrl, getVideoUrl, listSubtitles } from '@/lib/videos';
import { AvatarStack } from '../Avatar';
import { RoomChat } from './RoomChat';
import styles from './Watch.module.css';

type MemberRow = { user_id: string; profiles: { display_name: string } | null };
type Sync = 'synced' | 'syncing' | 'offline';
const REACTIONS = ['🔥', '😂', '😮', '❤️', '👏'];

async function measureOffset(): Promise<number> {
  const samples: { rtt: number; offset: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('server_time');
    const t1 = Date.now();
    if (error || !data) continue;
    samples.push({ rtt: t1 - t0, offset: Date.parse(data as string) - (t0 + t1) / 2 });
  }
  if (!samples.length) return 0;
  samples.sort((a, b) => a.rtt - b.rtt);
  return samples[0].offset;
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
  return null;
}

export function Watch({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [room, setRoom] = useState<DbRoom | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [subs, setSubs] = useState<SubtitleRow[]>([]);
  const [subLang, setSubLang] = useState('off');
  const [subUrl, setSubUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [sync, setSync] = useState<Sync>('syncing');
  const [needsTap, setNeedsTap] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; left: number }[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pbRef = useRef<Playback | null>(null);
  const offsetRef = useRef(0);
  const needsTapRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const floatId = useRef(0);

  const isHost = room?.host_id === user?.id;
  const canControl = Boolean(room && (isHost || room.sync_controls));

  useEffect(() => { needsTapRef.current = needsTap; }, [needsTap]);

  // Local-only preferences
  useEffect(() => {
    const v = parseFloat(store('rivva:volume') ?? '');
    if (!Number.isNaN(v)) setVolume(Math.min(1, Math.max(0, v)));
    setSubLang(store('rivva:subtitle') ?? 'off');
  }, []);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; }, [volume, src]);

  const expectedAt = useCallback((pb: Playback) => {
    if (!pb.playing) return pb.position;
    return pb.position + Math.max(0, Date.now() + offsetRef.current - Date.parse(pb.updated_at)) / 1000;
  }, []);

  const applyRemote = useCallback((pb: Playback, hard = false) => {
    pbRef.current = pb;
    const v = videoRef.current;
    if (!v || v.readyState < 1) return; // loadedmetadata re-applies once ready
    const target = expectedAt(pb);
    if (hard || Math.abs(v.currentTime - target) > 0.5) v.currentTime = target;
    if (pb.playing) v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    else v.pause();
  }, [expectedAt]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from('room_members').select('user_id, profiles(display_name)').eq('room_id', roomId).order('joined_at');
    setMembers(((data ?? []) as unknown as MemberRow[]).map((m) => ({ user_id: m.user_id, name: m.profiles?.display_name ?? 'Guest' })));
  }, [roomId]);

  // Initial load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (!r) { setFatal('Room not found'); return; }
      const rm = r as DbRoom;
      if (!rm.video_id) { router.replace(`/rooms/${roomId}`); return; }
      const { data: vrow } = await supabase.from('videos').select('*').eq('id', rm.video_id).maybeSingle();
      if (!vrow) { setFatal('This video is no longer available.'); return; }
      const vid = vrow as Video;
      const [url, subRows, pb, off] = await Promise.all([
        getVideoUrl(vid), listSubtitles(vid.id),
        supabase.from('room_playback').select('*').eq('room_id', roomId).maybeSingle(),
        measureOffset(), loadMembers(),
      ]);
      if (cancelled) return;
      offsetRef.current = off;
      pbRef.current = (pb.data as Playback | null) ?? null;
      setRoom(rm); setVideo(vid); setSrc(url); setSubs(subRows);
    })().catch((e) => setFatal(e instanceof Error ? e.message : 'Could not open the movie'));
    return () => { cancelled = true; };
  }, [roomId, user, router, loadMembers]);

  // Realtime: playback, room changes, members, presence, reactions
  const videoId = video?.id;
  useEffect(() => {
    if (!user || !videoId) return;
    const ch = supabase.channel(`watch:${roomId}`, { config: { presence: { key: user.id } } });
    channelRef.current = ch;
    ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_playback', filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType !== 'DELETE') applyRemote(p.new as Playback);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p) => {
        const next = p.new as DbRoom;
        setRoom(next);
        if (!next.video_id) router.replace(`/rooms/${roomId}`);
        else if (next.video_id !== videoId) window.location.reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => { loadMembers(); })
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (REACTIONS.includes(payload?.emoji)) showReaction(payload.emoji);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ at: Date.now() });
          setSync('syncing');
          // catch anything we missed while connecting
          const { data } = await supabase.from('room_playback').select('*').eq('room_id', roomId).maybeSingle();
          if (data) applyRemote(data as Playback, true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSync('offline');
        }
      });
    return () => { channelRef.current = null; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, videoId, applyRemote, loadMembers, router]);

  // Drift correction every 1.5s
  useEffect(() => {
    const t = setInterval(() => {
      const pb = pbRef.current;
      const v = videoRef.current;
      if (!pb || !v || v.readyState < 1) return;
      const target = expectedAt(pb);
      const diff = Math.abs(v.currentTime - target);
      if (pb.playing) {
        if (v.paused && !needsTapRef.current) v.play().catch(() => setNeedsTap(true));
        if (diff > 0.75) v.currentTime = target;
      } else {
        if (!v.paused) v.pause();
        if (diff > 0.3) v.currentTime = pb.position;
      }
      setSync((s) => (s === 'offline' ? s : diff < 1.5 ? 'synced' : 'syncing'));
    }, 1500);
    return () => clearInterval(t);
  }, [expectedAt]);

  // Subtitles (per person)
  useEffect(() => {
    if (subLang === 'off') { setSubUrl(null); return; }
    const row = subs.find((s) => s.lang === subLang);
    if (!row) { setSubUrl(null); return; }
    let live = true;
    let made: string | null = null;
    getSubtitleUrl(row.path).then((u) => { made = u; if (live) setSubUrl(u); else URL.revokeObjectURL(u); })
      .catch(() => setNotice('Could not load subtitles'));
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [subLang, subs]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = setTimeout(() => Array.from(v.textTracks).forEach((tr) => { tr.mode = 'showing'; }), 150);
    return () => clearTimeout(t);
  }, [subUrl]);

  function showReaction(emoji: string) {
    const id = ++floatId.current;
    setFloaters((f) => [...f, { id, emoji, left: 10 + Math.random() * 60 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2400);
  }

  function react(emoji: string) {
    if (!room?.allow_reactions) return;
    showReaction(emoji);
    channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
    setTrayOpen(false);
  }

  async function push(next: boolean, position: number) {
    // optimistic so the drift check doesn't undo what we just did
    pbRef.current = {
      room_id: roomId, playing: next, position, updated_by: user?.id ?? null,
      updated_at: new Date(Date.now() + offsetRef.current).toISOString(),
    };
    const { data, error } = await supabase.rpc('set_playback', { p_room: roomId, p_playing: next, p_position: position });
    if (error) { setNotice(error.message); return; }
    if (data) pbRef.current = data as Playback;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (!canControl) { setNotice('Only the host controls playback in this room.'); return; }
    const next = v.paused;
    if (next) v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true)); else v.pause();
    push(next, v.currentTime);
  }

  function commitSeek() {
    const v = videoRef.current;
    if (v == null || scrub == null) return;
    const to = scrub;
    setScrub(null);
    if (!canControl) { setNotice('Only the host controls playback in this room.'); return; }
    v.currentTime = to;
    push(!v.paused, to);
  }

  async function joinNow() {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      setNeedsTap(false);
      if (pbRef.current) applyRemote(pbRef.current, true);
    } catch { /* still blocked */ }
  }

  async function onEndMovie() {
    try { await endMovie(roomId); router.replace(`/rooms/${roomId}`); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not end the movie'); }
  }

  function chooseSub(lang: string) {
    setSubLang(lang);
    store('rivva:subtitle', lang);
  }

  if (fatal) {
    return (
      <div className={styles.fatal}>
        <p>{fatal}</p>
        <Link href={`/rooms/${roomId}`} className={styles.fatalBtn}>Back to the lobby</Link>
      </div>
    );
  }
  if (!room || !video || !src) return <div className={styles.fatal}><p>Opening the movie…</p></div>;

  const shown = scrub ?? current;
  const pct = duration > 0 ? (shown / duration) * 100 : 0;
  const muted = volume === 0;

  return (
    <div className={`${styles.root} ${chatOpen ? styles.chatOpen : ''}`}>
      <div className={styles.player}>
        <video
          ref={videoRef} className={styles.video} src={src} playsInline preload="auto" crossOrigin="anonymous"
          onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); if (pbRef.current) applyRemote(pbRef.current, true); }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { if (canControl) push(false, duration); }}
          onError={() => setNotice('This video can’t be played in the browser. Use an MP4 (H.264) or WebM file.')}
        >
          {subUrl && <track key={subUrl} kind="subtitles" src={subUrl} srcLang={subLang} label={subs.find((s) => s.lang === subLang)?.label} default />}
        </video>

        <header className={styles.top}>
          <div className={styles.titleRow}>
            <Link href={`/rooms/${roomId}`} aria-label="Back to lobby" className={styles.iconBtn}><ArrowLeft size={24} /></Link>
            <h1 className={styles.title}>{video.title}</h1>
            <div className={styles.topActions}>
              <button className={styles.iconBtn} onClick={() => { setChatOpen(true); setSettingsOpen(false); }} aria-label="Open chat"><MessageCircle size={24} /></button>
              <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Watch settings"><Settings size={24} /></button>
            </div>
          </div>
          <AvatarStack names={members.slice(0, 6).map((m) => m.name)} />
        </header>

        {needsTap && (
          <button className={styles.tap} onClick={joinNow}><Play size={32} fill="currentColor" /> Tap to join the movie</button>
        )}
        {notice && <button className={styles.notice} onClick={() => setNotice(null)}>{notice}</button>}

        <div className={styles.floaters} aria-hidden>
          {floaters.map((f) => <span key={f.id} className={styles.floater} style={{ left: `${f.left}%` }}>{f.emoji}</span>)}
        </div>

        <footer className={styles.controls}>
          <input
            type="range" className={styles.range} style={{ ['--pct' as string]: `${pct}%` }}
            min={0} max={duration || 1} step={0.1} value={Math.min(shown, duration || 1)} aria-label="Seek"
            disabled={!canControl}
            onChange={(e) => setScrub(parseFloat(e.target.value))}
            onPointerUp={commitSeek} onKeyUp={commitSeek} onBlur={commitSeek}
          />
          <div className={styles.times}><span>{formatClock(shown)}</span><span>{formatClock(duration)}</span></div>
          <div className={styles.row}>
            <button className={styles.iconBtn} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={!canControl}>
              {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <div className={styles.vol}>
              <button className={styles.iconBtn} aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { const v = muted ? 1 : 0; setVolume(v); store('rivva:volume', String(v)); }}>
                {muted ? <VolumeX size={26} /> : <Volume2 size={26} />}
              </button>
              <input
                type="range" className={`${styles.range} ${styles.volRange}`} style={{ ['--pct' as string]: `${volume * 100}%` }}
                min={0} max={1} step={0.02} value={volume} aria-label="Your volume"
                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); store('rivva:volume', String(v)); }}
              />
            </div>
            <span className={`${styles.sync} ${styles[sync]}`} role="status">
              <Wifi size={22} /> {sync === 'synced' ? 'Synced' : sync === 'syncing' ? 'Syncing…' : 'Offline'}
            </span>
            {room.allow_reactions ? (
              <div className={styles.reactWrap}>
                {trayOpen && (
                  <div className={styles.tray}>
                    {REACTIONS.map((e) => <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>{e}</button>)}
                  </div>
                )}
                <button className={styles.iconBtn} onClick={() => setTrayOpen((o) => !o)} aria-label="Reactions"><SmilePlus size={26} /></button>
              </div>
            ) : <span className={styles.spacer} />}
          </div>
        </footer>
      </div>

      {chatOpen && <RoomChat roomId={roomId} members={members} enabled={room.chat_enabled} online={online} onClose={() => setChatOpen(false)} />}

      {settingsOpen && (
        <div className={styles.sheetWrap} onClick={() => setSettingsOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-label="Watch settings" onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHead}><h2>Watch settings</h2><button onClick={() => setSettingsOpen(false)} aria-label="Close"><X size={24} /></button></div>
            <h3 className={styles.sheetLabel}>Subtitles <span>only for you</span></h3>
            <div className={styles.options}>
              <button className={subLang === 'off' ? styles.optOn : styles.opt} onClick={() => chooseSub('off')}>Off</button>
              {subs.map((s) => (
                <button key={s.id} className={subLang === s.lang ? styles.optOn : styles.opt} onClick={() => chooseSub(s.lang)}>{s.label}</button>
              ))}
            </div>
            {subs.length === 0 && <p className={styles.sheetNote}>This video has no subtitles yet. The host can add them when uploading.</p>}
            <p className={styles.sheetNote}>
              {room.sync_controls ? 'Everyone can play, pause and seek for the whole room.' : 'Only the host controls playback.'}
            </p>
            {isHost && (
              <div className={styles.hostBtns}>
                <Link href={`/rooms/${roomId}/content`} className={styles.opt}>Change movie</Link>
                <button className={styles.danger} onClick={onEndMovie}>End movie</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
