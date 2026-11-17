'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { listNotifications, markAllRead, markRead, showBrowserAlert, type AppNotification } from './notifications';
import { supabase } from './supabase';

type Ctx = { items: AppNotification[]; unread: number; read: (id: string) => void; readAll: () => void };
const NotificationsContext = createContext<Ctx>({ items: [], unread: 0, read: () => {}, readAll: () => {} });

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) { setItems([]); return; }
    let live = true;
    listNotifications().then((list) => { if (live) setItems(list); }).catch(() => { /* optional feature: stay quiet */ });
    const ch = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as AppNotification;
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
        showBrowserAlert(n);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as AppNotification;
        setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
      })
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [userId]);

  const read = useCallback((id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id && !x.read_at ? { ...x, read_at: new Date().toISOString() } : x)));
    markRead(id);
  }, []);
  const readAll = useCallback(() => {
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    markAllRead();
  }, []);

  const value = useMemo(() => ({ items, unread: items.filter((i) => !i.read_at).length, read, readAll }), [items, read, readAll]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
