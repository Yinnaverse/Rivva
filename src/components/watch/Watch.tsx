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
const HOLD_LIMIT_MS = 20000; // never keep the room waiting longer than this

async function measureClock(): Promise<{ offset: number; rtt: number }> {
  const samples: { rtt: number; offset: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('server_time');
    const t1 = Date.now();
    if (error || !data) continue;
    samples.push({ rtt: t1 - t0, offset: Date.parse(data as string) - (t0 + t1) / 2 });
  }
  if (!samples.length) return { offset: 0, rtt: 0 };
  samples.sort((x, y) => x.rtt - y.rtt); // the fastest round trip is the most accurate
  return samples[0];
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
  return null;
}

export function Watch({ roomId }: { roomId: string }) {
  const { user, displayName } = useAuth();
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
  const [held, setHeld] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string[]>([]);
  const [localBuffering, setLocalBuffering] = useState(false);
  const [peerTick, setPeerTick] = useState(0);
  const [debug, setDebug] = useState(false);
  const [dbg, setDbg] = useState('');
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
  const rttRef = useRef(0);
  const lastSeekRef = useRef(0);
  const lastResumeRef = useRef(0);
  const driftRef = useRef(0);
  const bufferingRef = useRef(false);
  const startedRef = useRef(false);
  const peersRef = useRef<{ key: string; name: string; buffering: boolean }[]>([]);

  const isHost = room?.host_id === user?.id;
  const canControl = Boolean(room && (isHost || room.sync_controls));

  useEffect(() => { needsTapRef.current = needsTap; }, [needsTap]);

  // Local-only preferences
  useEffect(() => {
    const v = parseFloat(store('rivva:volume') ?? '');
    if (!Number.isNaN(v)) setVolume(Math.min(1, Math.max(0, v)));
    setSubLang(store('rivva:subtitle') ?? 'off');
    setDebug(store('rivva:debug') === '1');
  }, []);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; }, [volume, src]);

  const expectedAt = useCallback((pb: Playback) => {
    if (!pb.playing) return pb.position;
    return pb.position + Math.max(0, Date.now() + offsetRef.current - Date.parse(pb.updated_at)) / 1000;
  }, []);

  const applyRemote = useCallback((pb: Playback, hard = false) => {
    pbRef.current = pb;
    setHeld(Boolean(pb.held));
    const v = videoRef.current;
    if (!v || v.readyState < 1) return; // loadedmetadata re-applies once ready
    const target = expectedAt(pb);
    if (hard || Math.abs(v.currentTime - target) > 0.8) { v.currentTime = target; lastSeekRef.current = Date.now(); }
    v.playbackRate = 1;
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
        measureClock(), loadMembers(),
      ]);
      if (cancelled) return;
      offsetRef.current = off.offset;
      rttRef.current = off.rtt;
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
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as unknown as Record<string, { name?: string; buffering?: boolean }[]>;
        setOnline(new Set(Object.keys(state)));
        peersRef.current = Object.entries(state).map(([key, metas]) => {
          const last = metas[metas.length - 1];
          return { key, name: last?.name ?? 'Someone', buffering: Boolean(last?.buffering) };
        });
        setWaitingFor(peersRef.current.filter((p) => p.buffering && p.key !== user.id).map((p) => p.name));
        setPeerTick((n) => n + 1);
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (REACTIONS.includes(payload?.emoji)) showReaction(payload.emoji);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ name: displayName, buffering: bufferingRef.current });
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

  // Stay in step with the room: nudge playback speed for small drift, seek only when far off
  useEffect(() => {
    const t = setInterval(() => {
      const pb = pbRef.current;
      const v = videoRef.current;
      if (!pb || !v || v.readyState < 1) return;
      const target = expectedAt(pb);
      const behind = target - v.currentTime; // positive = this device is behind the room
      const diff = Math.abs(behind);
      driftRef.current = behind;
      if (pb.playing) {
        if (v.paused && !needsTapRef.current) v.play().catch(() => setNeedsTap(true));
        const settled = !v.seeking && v.readyState >= 3 && Date.now() - lastSeekRef.current > 4000;
        if (diff > 2.5 && settled) {
          v.currentTime = target;
          lastSeekRef.current = Date.now();
          v.playbackRate = 1;
        } else if (diff > 0.15 && diff <= 2.5) {
          v.playbackRate = Math.min(1.08, Math.max(0.92, 1 + behind * 0.15));
        } else if (diff <= 0.15 && v.playbackRate !== 1) {
          v.playbackRate = 1;
        }
      } else {
        v.playbackRate = 1;
        if (!v.paused) v.pause();
        if (diff > 0.3) { v.currentTime = pb.position; lastSeekRef.current = Date.now(); }
      }
      setSync((x) => (x === 'offline' ? x : diff < 1.5 ? 'synced' : 'syncing'));
    }, 1000);
    return () => clearInterval(t);
  }, [expectedAt]);

  // Re-measure the clock difference now and then; phones and networks wander
  useEffect(() => {
    const t = setInterval(async () => {
      const c = await measureClock();
      if (c.rtt) { offsetRef.current = c.offset; rttRef.current = c.rtt; }
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // Optional on-screen sync readout (Watch settings → Sync info)
  useEffect(() => {
    if (!debug) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      const pb = pbRef.current;
      if (!v) return;
      setDbg([
        `drift ${driftRef.current.toFixed(2)}s (+ = behind)`,
        `speed ${v.playbackRate.toFixed(2)}x  ready ${v.readyState}  seeking ${v.seeking ? 'yes' : 'no'}`,
        `clock offset ${Math.round(offsetRef.current)}ms  round trip ${Math.round(rttRef.current)}ms`,
        `room ${pb ? (pb.playing ? 'playing' : pb.held ? 'held' : 'paused') : '-'} @ ${pb ? pb.position.toFixed(1) : '-'}s`,
        `connection ${sync}`,
      ].join('\n'));
    }, 1000);
    return () => clearInterval(t);
  }, [debug, sync]);

  // Buffering: tell the room when this device can't keep up
  const updateBuffering = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setLocalBuffering(v.readyState < 3 && !v.ended);
  }, []);
  useEffect(() => {
    const t = setInterval(updateBuffering, 1500);
    return () => clearInterval(t);
  }, [updateBuffering]);
  useEffect(() => {
    bufferingRef.current = localBuffering;
    channelRef.current?.track({ name: displayName, buffering: localBuffering });
  }, [localBuffering, displayName]);

  // If this device stalls mid-movie, freeze the room at this spot
  useEffect(() => {
    if (!localBuffering) return;
    const t = setTimeout(async () => {
      const v = videoRef.current;
      const pb = pbRef.current;
      if (!v || !pb || !pb.playing || pb.held || !startedRef.current || v.readyState >= 3) return;
      if (Date.now() - lastSeekRef.current < 4000 || Date.now() - lastResumeRef.current < 10000) return; // our own seek or a recent resume, not a real stall
      const { data } = await supabase.rpc('hold_playback', { p_room: roomId, p_position: v.currentTime });
      if (data) applyRemote(data as Playback);
    }, 1500);
    return () => clearTimeout(t);
  }, [localBuffering, roomId, applyRemote]);

  // While frozen, resume together once everyone is ready (or after a maximum wait)
  useEffect(() => {
    if (!held) return;
    const pb = pbRef.current;
    const heldFor = pb ? Date.now() + offsetRef.current - Date.parse(pb.updated_at) : 0;
    const everyoneReady = !localBuffering && peersRef.current.every((p) => !p.buffering);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('resume_playback', { p_room: roomId });
      lastResumeRef.current = Date.now();
      if (data) applyRemote(data as Playback);
    }, everyoneReady ? 600 : Math.max(0, HOLD_LIMIT_MS - heldFor));
    return () => clearTimeout(t);
  }, [held, localBuffering, peerTick, roomId, applyRemote]);

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
      room_id: roomId, playing: next, held: false, position, updated_by: user?.id ?? null,
      updated_at: new Date(Date.now() + offsetRef.current).toISOString(),
    };
    // While playing, the movie keeps moving as this request travels to the server, so send
    // where it will be on arrival (half the round trip ahead). Pausing needs no adjustment.
    const sent = next ? position + rttRef.current / 2000 : position;
    const { data, error } = await supabase.rpc('set_playback', { p_room: roomId, p_playing: next, p_position: sent });
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
          onPlaying={() => { startedRef.current = true; updateBuffering(); }}
          onWaiting={updateBuffering} onStalled={updateBuffering} onCanPlay={updateBuffering} onSeeked={updateBuffering} onLoadedData={updateBuffering}
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

        {debug && <pre className={styles.debug}>{dbg}</pre>}
        {held && (
          <div className={styles.waiting} role="status">
            <span className={styles.spinner} aria-hidden />
            {(() => {
              const names = [...(localBuffering ? ['you'] : []), ...waitingFor];
              return names.length ? `Waiting for ${names.join(', ')} to catch up…` : 'Getting everyone ready…';
            })()}
          </div>
        )}
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
            <span className={`${styles.sync} ${styles[held ? 'syncing' : sync]}`} role="status">
              <Wifi size={22} /> {held ? 'Waiting…' : sync === 'synced' ? 'Synced' : sync === 'syncing' ? 'Syncing…' : 'Offline'}
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
            <h3 className={styles.sheetLabel}>Sync info <span>for troubleshooting</span></h3>
            <div className={styles.options}>
              <button className={debug ? styles.optOn : styles.opt} onClick={() => { const n = !debug; setDebug(n); store('rivva:debug', n ? '1' : '0'); }}>{debug ? 'Showing' : 'Hidden'}</button>
            </div>
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
