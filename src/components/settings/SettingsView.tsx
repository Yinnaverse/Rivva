'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, LogOut, Monitor, Moon, Palette, Sun, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/lib/supabase';
import { applyTheme, getThemePref, type ThemePref } from '@/lib/theme';
import type { Video } from '@/lib/types';
import { deleteVideo } from '@/lib/videos';
import { Avatar } from '../Avatar';
import { AvatarEditor } from './AvatarEditor';
import { deleteAvatarFiles, removeAvatar, saveAvatar } from '@/lib/avatar';
import { Button } from '../Button';
import { FriendsSection } from './FriendsSection';
import { NotificationsSection } from './NotificationsSection';
import styles from './SettingsView.module.css';
import { BRAND } from '@/lib/brand';

const THEMES: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'system', label: 'System', Icon: Monitor },
];

export function SettingsView() {
  const { user, displayName, avatarUrl, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<ThemePref>('dark');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => setTheme(getThemePref()), []);
  useEffect(() => setName(displayName), [displayName]);

  const isGuest = Boolean(user?.is_anonymous);
  const nameChanged = name.trim() !== '' && name.trim() !== displayName;

  async function saveName() {
    if (!user || !nameChanged) return;
    setSaving(true);
    const clean = name.trim().slice(0, 40);
    const { error: e1 } = await supabase.from('profiles').update({ display_name: clean }).eq('id', user.id);
    const { error: e2 } = await supabase.auth.updateUser({ data: { name: clean } });
    setSaving(false);
    setMessage(e1 || e2 ? { kind: 'error', text: (e1 ?? e2)!.message } : { kind: 'ok', text: 'Name updated.' });
  }

  async function changePassword() {
    if (newPw.length < 8) { setMessage({ kind: 'error', text: 'Use at least 8 characters.' }); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setNewPw(''); setMessage({ kind: 'ok', text: 'Password updated.' }); }
  }

  async function onSaveAvatar(blob: Blob) {
    if (!user) return;
    await saveAvatar(user.id, blob);
    await refreshProfile();
    setPickedFile(null);
    setMessage({ kind: 'ok', text: 'Profile picture updated.' });
  }

  async function onRemoveAvatar() {
    if (!user) return;
    try { await removeAvatar(user.id); await refreshProfile(); setMessage({ kind: 'ok', text: 'Profile picture removed.' }); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not remove it' }); }
  }

  function pickTheme(t: ThemePref) {
    setTheme(t);
    applyTheme(t);
  }

  async function downloadData() {
    if (!user) return;
    setMessage(null);
    try {
      const [profile, hosted, memberships, messages, videos, saved] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('rooms').select('id, code, name, description, is_private, created_at').eq('host_id', user.id),
        supabase.from('room_members').select('room_id, joined_at').eq('user_id', user.id),
        supabase.from('messages').select('room_id, body, created_at').eq('user_id', user.id),
        supabase.from('videos').select('id, title, source_url, file_name, size_bytes, duration_seconds, is_shared, created_at').eq('owner_id', user.id),
        supabase.from('saved_videos').select('video_id, created_at'),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email ?? null, guest: Boolean(user.is_anonymous) },
        profile: profile.data, rooms_hosted: hosted.data, room_memberships: memberships.data,
        messages_sent: messages.data, uploaded_videos: videos.data, saved_videos: saved.data,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'rivva-my-data.json'; a.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: 'ok', text: 'Your data was downloaded.' });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not export your data' });
    }
  }

  function clearLocal() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('rivva:')).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
    setTheme('dark');
    applyTheme('dark');
    setMessage({ kind: 'ok', text: 'Saved volume, subtitle and theme choices were cleared on this device.' });
  }

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  async function deleteAccount() {
    if (!user || typed !== 'DELETE') return;
    setDeleting(true);
    setMessage(null);
    try {
      const { data: mine } = await supabase.from('videos').select('*').eq('owner_id', user.id);
      for (const v of (mine ?? []) as Video[]) await deleteVideo(v); // removes stored files too
      await deleteAvatarFiles(user.id);
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
      await supabase.auth.signOut({ scope: 'local' });
      router.replace('/login');
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not delete your account' });
      setDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Settings</h1>

      <section className={styles.card}>
        <div className={styles.head}><h2>Profile</h2><p>Manage your account information</p></div>
        <div className={styles.field}>
          <label htmlFor="display-name">Display Name</label>
          <input id="display-name" className={styles.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>Email</label>
          <div className={`${styles.input} ${styles.readonly}`}>{user?.email ?? (isGuest ? 'Guest account (no email)' : '—')}</div>
        </div>
        <div className={styles.avatarRow}>
          <div className={styles.avatarBox}>
            <span>Profile picture</span>
            <div className={styles.avatarLine}>
              <Avatar name={displayName} src={avatarUrl} size={64} />
              <div className={styles.avatarBtns}>
                <button type="button" className={styles.small} onClick={() => fileInput.current?.click()}>{avatarUrl ? 'Change' : 'Add picture'}</button>
                {avatarUrl && <button type="button" className={styles.small} onClick={onRemoveAvatar}>Remove</button>}
              </div>
            </div>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPickedFile(f); e.target.value = ''; }} />
          </div>
          <Button onClick={saveName}>{saving ? 'Saving…' : 'Save name'}</Button>
        </div>
        {!isGuest && (
          <div className={styles.field}>
            <label htmlFor="new-password">Change password</label>
            <input id="new-password" type="password" className={styles.input} value={newPw} placeholder="New password (8+ characters)" autoComplete="new-password" onChange={(e) => setNewPw(e.target.value)} />
            <Button onClick={changePassword}>{pwBusy ? 'Updating…' : 'Update password'}</Button>
          </div>
        )}
        {isGuest && <p className={styles.note}>You’re using a guest account. It only lives on this device, so sign up to use {BRAND.name} anywhere.</p>}
      </section>

      <section className={styles.card}>
        <div className={styles.head}><h2><Palette size={22} /> Appearance</h2><p>Choose how {BRAND.name} looks</p></div>
        <div role="radiogroup" aria-label="Theme" className={styles.segment}>
          {THEMES.map(({ id, label, Icon }) => (
            <button key={id} role="radio" aria-checked={theme === id} className={`${styles.seg} ${theme === id ? styles.segOn : ''}`} onClick={() => pickTheme(id)}>
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>
      </section>

      <NotificationsSection />

      <FriendsSection />

      <section className={styles.card}>
        <div className={styles.head}><h2>Privacy &amp; Data</h2><p>Manage your data and privacy settings</p></div>
        <button className={styles.action} onClick={downloadData}><Download size={24} /> Download my data</button>
        <button className={styles.action} onClick={clearLocal}>Clear saved choices on this device</button>
        {!confirming ? (
          <button className={styles.danger} onClick={() => setConfirming(true)}><Trash2 size={24} /> Delete my account</button>
        ) : (
          <div className={styles.confirm}>
            <p>This permanently deletes your account, your rooms, your messages and every video you uploaded. It can’t be undone.</p>
            <label htmlFor="confirm-delete">Type <strong>DELETE</strong> to confirm</label>
            <input id="confirm-delete" className={styles.input} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
            <div className={styles.confirmRow}>
              <button className={styles.action} onClick={() => { setConfirming(false); setTyped(''); }}>Cancel</button>
              <button className={styles.danger} disabled={typed !== 'DELETE' || deleting} onClick={deleteAccount}>{deleting ? 'Deleting…' : 'Delete forever'}</button>
            </div>
          </div>
        )}
      </section>

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? styles.error : styles.ok}>{message.text}</p>}

      <button className={styles.action} onClick={logout}><LogOut size={24} /> Logout</button>

      {pickedFile && <AvatarEditor file={pickedFile} onCancel={() => setPickedFile(null)} onSave={onSaveAvatar} />}
    </div>
  );
}
