'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import {
  listFriendships, otherPerson, removeFriendship, respondToRequest, sendFriendRequest, type Friendship,
} from '@/lib/friends';
import { supabase } from '@/lib/supabase';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import shared from './SettingsView.module.css';
import styles from './FriendsSection.module.css';

const USERNAME = /^[a-z0-9_]{3,20}$/;

export function FriendsSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Friendship[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [addInput, setAddInput] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const me = user?.id ?? '';
  const isGuest = Boolean(user?.is_anonymous);

  const load = useCallback(async () => {
    if (!user || user.is_anonymous) return;
    try { setRows(await listFriendships()); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load friends' }); }
    const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
    setUsername((data?.username as string | null | undefined) ?? null);
  }, [user]);

  useEffect(() => {
    load();
    if (!user || user.is_anonymous) return;
    const ch = supabase.channel('friends').on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  if (isGuest) {
    return (
      <section className={shared.card}>
        <div className={shared.head}><h2>Friends</h2><p>Connect and watch with friends</p></div>
        <p className={shared.note}>Friends need a full account, because a guest account only lives on this device. Sign up to add friends and invite them to rooms.</p>
      </section>
    );
  }

  const friends = rows.filter((r) => r.status === 'accepted');
  const incoming = rows.filter((r) => r.status === 'pending' && r.addressee_id === me);
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requester_id === me);

  async function saveUsername() {
    const clean = nameInput.trim().toLowerCase().replace(/^@/, '');
    if (!USERNAME.test(clean)) { setMsg({ kind: 'error', text: 'Usernames are 3 to 20 letters, numbers or underscores.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', me);
    setBusy(false);
    if (error) setMsg({ kind: 'error', text: error.code === '23505' ? 'That username is taken.' : error.message });
    else { setUsername(clean); setNameInput(''); setMsg({ kind: 'ok', text: `You’re @${clean}. Friends can find you with that.` }); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!addInput.trim()) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest(addInput);
      setMsg({ kind: 'ok', text: result === 'accepted' ? 'You’re now friends.' : 'Request sent.' });
      setAddInput('');
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not send the request' });
    }
    setBusy(false);
  }

  async function act(fn: () => Promise<void>) {
    try { await fn(); await load(); } catch (err) { setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong' }); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/add/${username}`);
      setMsg({ kind: 'ok', text: 'Link copied. Anyone who opens it can send you a friend request.' });
    } catch { setMsg({ kind: 'error', text: `Share this link: ${window.location.origin}/add/${username}` }); }
  }

  return (
    <section className={shared.card}>
      <div className={shared.head}><h2>Friends ({friends.length})</h2><p>Connect and watch with friends</p></div>

      <div className={shared.field}>
        <label htmlFor="my-username">Your username</label>
        {username ? (
          <div className={styles.mine}>
            <span className={styles.handle}>@{username}</span>
            <button className={styles.small} onClick={copyLink}><Copy size={16} /> Copy invite link</button>
          </div>
        ) : (
          <div className={styles.row}>
            <input id="my-username" className={shared.input} value={nameInput} placeholder="pick a username" maxLength={20} autoCapitalize="none" autoComplete="off"
              onChange={(e) => setNameInput(e.target.value)} />
            <Button onClick={saveUsername}>{busy ? '…' : 'Save'}</Button>
          </div>
        )}
        {!username && <p className={shared.note}>Pick a username so friends can find you.</p>}
      </div>

      <form className={shared.field} onSubmit={add}>
        <label htmlFor="add-friend">Add a friend</label>
        <div className={styles.row}>
          <input id="add-friend" className={shared.input} value={addInput} placeholder="their username" autoCapitalize="none" autoComplete="off" onChange={(e) => setAddInput(e.target.value)} />
          <button type="submit" className={styles.addBtn} disabled={busy || !addInput.trim()} aria-label="Send friend request"><UserPlus size={22} /></button>
        </div>
      </form>

      {incoming.length > 0 && (
        <div className={styles.group}>
          <h3>Requests</h3>
          {incoming.map((r) => {
            const p = otherPerson(r, me);
            return (
              <div key={r.id} className={styles.person}>
                <Avatar name={p?.display_name ?? 'Guest'} size={38} />
                <div className={styles.who}><span>{p?.display_name}</span><span className={styles.sub}>@{p?.username}</span></div>
                <button className={styles.iconBtn} aria-label="Accept" onClick={() => act(() => respondToRequest(r.id, true))}><Check size={22} color="var(--success)" /></button>
                <button className={styles.iconBtn} aria-label="Decline" onClick={() => act(() => respondToRequest(r.id, false))}><X size={22} /></button>
              </div>
            );
          })}
        </div>
      )}

      {friends.length > 0 ? (
        <div className={styles.group}>
          {friends.map((r) => {
            const p = otherPerson(r, me);
            return (
              <div key={r.id} className={styles.person}>
                <Avatar name={p?.display_name ?? 'Guest'} size={38} />
                <div className={styles.who}><span>{p?.display_name}</span><span className={styles.sub}>@{p?.username ?? '—'}</span></div>
                <button className={styles.small} onClick={() => confirm(`Remove ${p?.display_name}?`) && act(() => removeFriendship(r.id))}>Remove</button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={shared.note}>No friends yet. Add someone by username above.</p>
      )}

      {outgoing.length > 0 && (
        <div className={styles.group}>
          <h3>Sent</h3>
          {outgoing.map((r) => {
            const p = otherPerson(r, me);
            return (
              <div key={r.id} className={styles.person}>
                <Avatar name={p?.display_name ?? 'Guest'} size={38} />
                <div className={styles.who}><span>{p?.display_name}</span><span className={styles.sub}>Waiting for them to accept</span></div>
                <button className={styles.small} onClick={() => act(() => removeFriendship(r.id))}>Cancel</button>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? shared.error : shared.ok}>{msg.text}</p>}
    </section>
  );
}
