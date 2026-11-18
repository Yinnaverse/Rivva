'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Crown, Globe, Lock, LockOpen, MessageCircle, Play, Settings, Share2, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { joinRoom } from '@/lib/rooms';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import type { ChatMessage, DbRoom, Member } from '@/lib/types';
import { Avatar } from '../Avatar';
import { BackButton } from '../BackButton';
import { Button } from '../Button';
import { Toggle } from '../Toggle';
import { InviteFriends } from './InviteFriends';
import styles from './Lobby.module.css';
import { BRAND } from '@/lib/brand';

type MemberRow = { user_id: string; profiles: { display_name: string; avatar_url: string | null } | null };
type MessageRow = { id: number; user_id: string; body: string; created_at: string };

export function Lobby({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [room, setRoom] = useState<DbRoom | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const membersRef = useRef<Member[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  const isHost = room?.host_id === user?.id;

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('room_members')
      .select('user_id, profiles(display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('joined_at');
    const list = ((data ?? []) as unknown as MemberRow[]).map((m) => ({
      user_id: m.user_id,
      name: m.profiles?.display_name ?? 'Guest',
      avatar: m.profiles?.avatar_url ?? null,
    }));
    membersRef.current = list;
    setMembers(list);
    return list;
  }, [roomId]);

  const nameFor = useCallback(async (uid: string) => {
    const known = membersRef.current.find((m) => m.user_id === uid);
    if (known) return known.name;
    const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle();
    return (data?.display_name as string | undefined) ?? 'Guest';
  }, []);

  // Initial load: room, membership (auto-join public rooms), recent chat.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (cancelled) return;
      if (!r) { setStatus('missing'); return; }
      let list = await loadMembers();
      if (!list.some((m) => m.user_id === user.id)) {
        try { await joinRoom(roomId); list = await loadMembers(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not join this room'); setStatus('missing'); return; }
      }
      const { data: msgs } = await supabase
        .from('messages').select('id, user_id, body, created_at')
        .eq('room_id', roomId).order('created_at', { ascending: false }).limit(50);
      const withNames = await Promise.all(
        ((msgs ?? []) as MessageRow[]).reverse().map(async (m) => ({
          ...m, name: list.find((x) => x.user_id === m.user_id)?.name ?? (await nameFor(m.user_id)),
        })),
      );
      if (cancelled) return;
      setRoom(r as DbRoom);
      setTitle((r as DbRoom).name);
      setDescription((r as DbRoom).description ?? '');
      setMessages(withNames);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [roomId, user, loadMembers, nameFor]);

  // Realtime: room changes, members, chat, and who is online.
  useEffect(() => {
    if (!user || status !== 'ready') return;
    const ch = supabase.channel(`lobby:${roomId}`, { config: { presence: { key: user.id } } });
    ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p) => {
        if (p.eventType === 'DELETE') { router.replace('/rooms'); return; }
        const next = p.new as DbRoom;
        setRoom(next);
        if (next.video_id && next.host_id !== user.id) router.push(`/rooms/${roomId}/watch`);
        setTitle((t) => (document.activeElement?.id === 'room-title' ? t : next.name));
        setDescription((d) => (document.activeElement?.id === 'room-desc' ? d : next.description ?? ''));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => { loadMembers(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async (p) => {
        const row = p.new as MessageRow;
        const name = await nameFor(row.user_id);
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, name }]));
      })
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async (s) => { if (s === 'SUBSCRIBED') await ch.track({ at: Date.now() }); });
    return () => { supabase.removeChannel(ch); };
  }, [roomId, user, status, router, loadMembers, nameFor]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  async function patch(values: Partial<DbRoom>) {
    if (!room || !isHost) return;
    setRoom({ ...room, ...values });
    const { error: e } = await supabase.from('rooms').update(values).eq('id', roomId);
    if (e) setError(e.message);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !user || !room?.chat_enabled) return;
    setDraft('');
    const { error: err } = await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, body });
    if (err) { setError(err.message); setDraft(body); }
  }

  async function copyCode() {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Could not copy. The code is ' + room.code); }
  }

  async function share() {
    if (!room) return;
    const url = `${window.location.origin}/rooms/join?code=${room.code}`;
    const text = `Join my ${BRAND.name} room “${room.name}” with code ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: BRAND.name, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* share sheet dismissed */ }
  }

  if (status === 'loading') return <p className={styles.muted}>Opening room…</p>;
  if (status === 'missing' || !room) {
    return (
      <div className={styles.missing}>
        <h1 className={styles.h1}>Room not found</h1>
        <p className={styles.muted}>{error ?? 'It may be private or no longer exist. If you have a code, you can join with it.'}</p>
        <Button href="/rooms/join">Join with a code</Button>
        <Link href="/" className={styles.muted}>Back home</Link>
      </div>
    );
  }

  void tick;
  const hostName = members.find((m) => m.user_id === room.host_id)?.name;

  return (
    <div className={styles.page}>
      <BackButton fallback="/rooms" label="Rooms" />
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>{room.name}</h1>
          {room.is_private ? <Lock size={28} aria-label="Private room" /> : <Globe size={28} aria-label="Public room" />}
          <span className={`${styles.badge} ${room.is_private ? styles.badgePrivate : ''}`}>
            {room.is_private ? <Lock size={12} /> : <LockOpen size={12} />}{room.is_private ? 'Private' : 'Open'}
          </span>
        </div>
        {room.description && <p className={styles.muted}>{room.description}</p>}
        <p className={styles.code}>Room code <strong>{room.code}</strong>{hostName ? ` · Hosted by ${hostName}` : ''}</p>
      </header>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <section className={styles.card}>
        <div className={styles.group}>
          <label htmlFor="room-title" className={styles.label}>Room Title</label>
          <input
            id="room-title" className={styles.input} value={title} maxLength={60} readOnly={!isHost}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { const t = title.trim(); if (t && t !== room.name) patch({ name: t }); else setTitle(room.name); }}
          />
        </div>
        <div className={styles.group}>
          <label htmlFor="room-desc" className={styles.label}>Description</label>
          <textarea
            id="room-desc" className={`${styles.input} ${styles.textarea}`} value={description} maxLength={200} readOnly={!isHost}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => { if (description !== (room.description ?? '')) patch({ description }); }}
          />
        </div>
        <div className={styles.switchRow}>
          <Toggle checked={room.is_private} onChange={(v) => patch({ is_private: v })} label="Private room" disabled={!isHost} />
          <span className={styles.label}>Private Room</span>
        </div>
        <div className={styles.pair}>
          <button type="button" className={styles.outline} onClick={copyCode}>{copied ? 'Copied' : 'Copy Code'} <Copy size={24} /></button>
          <button type="button" className={styles.outline} onClick={share}>Share <Share2 size={24} /></button>
        </div>
        {isHost ? (
          <Button full href={room.video_id ? `/rooms/${roomId}/watch` : `/rooms/${roomId}/content`}>
            {room.video_id ? 'Resume watching' : 'Choose Content & Start watching'} <Play size={16} fill="currentColor" />
          </Button>
        ) : room.video_id ? (
          <Button full href={`/rooms/${roomId}/watch`}>Join the movie <Play size={16} fill="currentColor" /></Button>
        ) : (
          <p className={styles.muted}>Waiting for the host to choose a movie…</p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><MessageCircle size={24} /><h2 className={styles.label}>Lobby Chat</h2></div>
        <div className={styles.messages} aria-live="polite">
          {messages.length === 0 && <p className={styles.muted}>No messages yet. Say hi.</p>}
          {messages.map((m) => (
            <div key={m.id} className={styles.msg}>
              <div className={styles.msgHead}>
                <span className={styles.msgName}>{m.user_id === user?.id ? 'You' : m.name}</span>
                <span className={styles.time}>{timeAgo(m.created_at)}</span>
              </div>
              <p>{m.body}</p>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <form className={styles.chatForm} onSubmit={send}>
          <input
            className={styles.input} aria-label="Message" value={draft} maxLength={500}
            placeholder={room.chat_enabled ? 'Say something to the group' : 'Chat is turned off'}
            disabled={!room.chat_enabled} onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className={styles.send} disabled={!room.chat_enabled || !draft.trim()}>Send</button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><Users size={24} /><h2 className={styles.label}>Participants({members.length})</h2></div>
        {members.map((m) => {
          const host = m.user_id === room.host_id;
          const isOnline = online.has(m.user_id);
          return (
            <div key={m.user_id} className={styles.member}>
              <span className={styles.avatarWrap}>
                <Avatar name={m.name} src={m.avatar} size={30} />
                <span className={`${styles.dot} ${isOnline ? styles.dotOn : ''}`} />
              </span>
              <div className={styles.memberBody}>
                <div className={styles.memberTop}>
                  <span>{m.user_id === user?.id ? 'You' : m.name}{host && <Crown size={16} className={styles.crown} aria-label="Host" />}</span>
                  {host && <span className={styles.hostTag}>Host</span>}
                </div>
                <span className={styles.time}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          );
        })}
      </section>

      <InviteFriends roomId={roomId} memberIds={members.map((m) => m.user_id)} />

      <section className={styles.card}>
        <div className={styles.cardHead}><Settings size={24} /><h2 className={styles.label}>Room Settings</h2></div>
        {([
          ['sync_controls', 'Sync controls'],
          ['allow_reactions', 'Allow reactions'],
          ['chat_enabled', 'Enable chat'],
        ] as const).map(([key, label]) => (
          <div key={key} className={styles.settingRow}>
            <span>{label}</span>
            <Toggle checked={room[key]} onChange={(v) => patch({ [key]: v })} label={label} disabled={!isHost} />
          </div>
        ))}
        {!isHost && <p className={styles.muted}>Only the host can change these.</p>}
      </section>
    </div>
  );
}
