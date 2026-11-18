'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import type { ChatMessage, Member } from '@/lib/types';
import { Avatar } from '../Avatar';
import styles from './RoomChat.module.css';

type Row = { id: number; user_id: string; body: string; created_at: string };
const NAME_COLORS = ['#2fd37f', '#f5a623', '#4ea1ff', '#c58bff', '#ff8aa0'];

export function RoomChat({
  roomId, members, enabled, online, onClose,
}: { roomId: string; members: Member[]; enabled: boolean; online: Set<string>; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const membersRef = useRef(members);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { membersRef.current = members; }, [members]);

  useEffect(() => {
    let live = true;
    const nameOf = async (uid: string) => {
      const known = membersRef.current.find((m) => m.user_id === uid);
      if (known) return known.name;
      const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle();
      return (data?.display_name as string | undefined) ?? 'Guest';
    };
    (async () => {
      const { data } = await supabase.from('messages').select('id, user_id, body, created_at')
        .eq('room_id', roomId).order('created_at', { ascending: false }).limit(50);
      const rows = ((data ?? []) as Row[]).reverse();
      const named = await Promise.all(rows.map(async (r) => ({ ...r, name: await nameOf(r.user_id) })));
      if (live) setMessages(named);
    })();
    const ch = supabase.channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async (p) => {
        const row = p.new as Row;
        const name = await nameOf(row.user_id);
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, name }]));
      })
      .subscribe();
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { live = false; clearInterval(t); supabase.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !user || !enabled) return;
    setDraft('');
    const { error: err } = await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, body });
    if (err) { setError(err.message); setDraft(body); } else setError(null);
  }

  void tick;
  return (
    <aside className={styles.drawer} aria-label="Room chat">
      <header className={styles.head}>
        <h2>Room chat</h2>
        <button type="button" onClick={onClose} aria-label="Close chat"><X size={24} /></button>
      </header>
      <div className={styles.list} aria-live="polite">
        {messages.length === 0 && <p className={styles.muted}>No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          const color = NAME_COLORS[m.user_id.charCodeAt(0) % NAME_COLORS.length];
          return mine ? (
            <div key={m.id} className={`${styles.msg} ${styles.mine}`}>
              <div className={styles.meta}><span className={styles.you}>You</span><span className={styles.time}>{timeAgo(m.created_at)}</span></div>
              <p className={`${styles.bubble} ${styles.bubbleMine}`}>{m.body}</p>
            </div>
          ) : (
            <div key={m.id} className={styles.msg}>
              <div className={styles.meta}>
                <span className={styles.who}>
                  <span className={styles.av}><Avatar name={m.name} src={members.find((x) => x.user_id === m.user_id)?.avatar} size={28} /><i className={`${styles.dot} ${online.has(m.user_id) ? styles.dotOn : ''}`} /></span>
                  <span style={{ color }}>{m.name}</span>
                </span>
                <span className={styles.time}>{timeAgo(m.created_at)}</span>
              </div>
              <p className={styles.bubble}>{m.body}</p>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <form className={styles.form} onSubmit={send}>
        <input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} aria-label="Message"
          placeholder={enabled ? 'Type a message' : 'Chat is turned off'} disabled={!enabled} />
        <button type="submit" aria-label="Send" disabled={!enabled || !draft.trim()}><Send size={20} /></button>
      </form>
    </aside>
  );
}
