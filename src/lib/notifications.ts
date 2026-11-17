import { supabase } from './supabase';

export type NotificationKind = 'friend_request' | 'friend_accepted' | 'room_invite' | 'movie_started';
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function markRead(id: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
}

export async function markAllRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}

// ───────── Browser alerts (shown while Rivva is open in a background tab or installed app) ─────────
export const ALERT_KINDS: { key: string; label: string; kinds: NotificationKind[] }[] = [
  { key: 'friends', label: 'Friend requests', kinds: ['friend_request', 'friend_accepted'] },
  { key: 'invites', label: 'Room invites', kinds: ['room_invite'] },
  { key: 'movies', label: 'Movie starting', kinds: ['movie_started'] },
];

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writePref(key: string, value: boolean) {
  try { localStorage.setItem(`rivva:alerts:${key}`, value ? '1' : '0'); } catch { /* storage unavailable */ }
}
export function readPref(key: string, fallback = true): boolean {
  const v = read(`rivva:alerts:${key}`);
  return v === null ? fallback : v === '1';
}

export function alertsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestAlertPermission(): Promise<NotificationPermission> {
  if (!alertsSupported()) return 'denied';
  return Notification.requestPermission();
}

export async function showBrowserAlert(n: AppNotification) {
  if (!alertsSupported() || Notification.permission !== 'granted' || !readPref('master', false)) return;
  const group = ALERT_KINDS.find((g) => g.kinds.includes(n.kind));
  if (group && !readPref(group.key)) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return; // already looking at the app
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.showNotification(n.title, { body: n.body ?? undefined, icon: '/icon.svg', tag: n.id, data: { link: n.link } });
}
