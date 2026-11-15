'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { AuthCard, Divider, Field } from './AuthCard';
import { Button } from './Button';
import styles from '@/app/(auth)/auth.module.css';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { session, signIn, signUp, signInAsGuest } = useAuth();
  const signup = mode === 'signup';
  const next = params.get('next');
  const dest = next && next.startsWith('/') ? next : '/';
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) router.replace(dest);
  }, [session, router, dest]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(null);
    setNotice(null);
    if (signup) {
      const name = String(form.get('name') ?? '').trim();
      const res = await signUp(name, email, password);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setNotice('Check your email to confirm your account, then sign in.');
    } else {
      const res = await signIn(email, password);
      if (res.error) setError(res.error);
    }
    setBusy(false);
  }

  async function onGuest() {
    setBusy(true);
    setError(null);
    const res = await signInAsGuest();
    if (res.error) setError(res.error);
    setBusy(false);
  }

  const switchHref = `${signup ? '/login' : '/signup'}${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <AuthCard subtitle={signup ? 'Create your account' : 'Welcome back'}>
      <form className={styles.form} onSubmit={onSubmit}>
        {signup && <Field id="name" label="Full Name" icon={<User size={24} />} placeholder="Your name" autoComplete="name" />}
        <Field id="email" label="Email" icon={<Mail size={24} />} type="email" placeholder="you@example.com" autoComplete="email" />
        <Field id="password" label="Password" icon={<Lock size={24} />} type="password" placeholder="Password" autoComplete={signup ? 'new-password' : 'current-password'} />
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        <Button full type="submit">{busy ? 'One moment…' : signup ? 'Create Account' : 'Login'}</Button>
      </form>

      <Divider />
      <button type="button" className={styles.social} disabled title="Google and Apple sign-in aren’t set up yet">Continue with Google</button>
      <button type="button" className={styles.social} disabled title="Google and Apple sign-in aren’t set up yet">Continue with Apple</button>
      <button type="button" className={styles.guest} onClick={onGuest} disabled={busy}>Continue as Guest</button>
      <p className={styles.switch}>
        {signup ? 'Already have an account? ' : 'Don’t have an account? '}
        <Link href={switchHref}>{signup ? 'Sign in' : 'Sign up'}</Link>
      </p>
    </AuthCard>
  );
}
