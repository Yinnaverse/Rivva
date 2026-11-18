'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthResult = { error: string | null; needsConfirmation?: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  displayName: string;
  avatarUrl: string | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signInAsGuest: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return { error: error.message };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signInAsGuest = useCallback<AuthContextValue['signInAsGuest']>(async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error?.message ?? null };
  }, []);

  const userId = session?.user?.id;
  const refreshProfile = useCallback(async () => {
    if (!userId) { setAvatarUrl(null); return; }
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
    setAvatarUrl((data?.avatar_url as string | null | undefined) ?? null);
  }, [userId]);
  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const meta = user?.user_metadata?.name as string | undefined;
    const displayName = meta?.trim() || user?.email?.split('@')[0] || 'Guest';
    return { session, user, loading, displayName, avatarUrl, refreshProfile, signIn, signUp, signInAsGuest, signOut };
  }, [session, loading, avatarUrl, refreshProfile, signIn, signUp, signInAsGuest, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
