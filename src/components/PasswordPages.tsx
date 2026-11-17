'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthCard, Field } from './AuthCard';
import { Button } from './Button';
import styles from '@/app/(auth)/auth.module.css';

/** Step 1: ask for an email. The answer is always the same, so nobody can check who has an account. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (err && /rate|too many|seconds/i.test(err.message)) setError('Too many requests. Please wait a few minutes and try again.');
    else if (err && err.status && err.status >= 500) setError('Something went wrong sending the email. Please try again.');
    else setSent(true);
  }

  return (
    <AuthCard subtitle="Reset your password">
      {sent ? (
        <>
          <p role="status">If an account exists for that email, a reset link is on its way. It can take a few minutes, so check your spam folder too.</p>
          <Link href="/login" className={styles.back}>Back to login</Link>
        </>
      ) : (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.back}>Enter your email and we’ll send you a link to choose a new password.</p>
          <Field id="email" label="Email" icon={<Mail size={24} />} type="email" placeholder="you@example.com" autoComplete="email" />
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <Button full type="submit">{busy ? 'Sending…' : 'Send reset link'}</Button>
          <Link href="/login" className={styles.back}>Back to login</Link>
        </form>
      )}
    </AuthCard>
  );
}

/** Step 2: the email link brings you here already signed in for recovery. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const t = setTimeout(() => setExpired(true), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) { setError('The two passwords don’t match.'); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setBusy(false); return; }
    router.replace('/');
  }

  if (!ready && expired) {
    return (
      <AuthCard subtitle="This link has expired">
        <p>Reset links work once and expire after a short while. Request a new one and use it right away.</p>
        <Button href="/forgot-password" full>Send a new link</Button>
      </AuthCard>
    );
  }
  if (!ready) return <AuthCard subtitle="Checking your link…"><p className={styles.back}>One moment…</p></AuthCard>;

  return (
    <AuthCard subtitle="Choose a new password">
      <form className={styles.form} onSubmit={onSubmit}>
        <Field id="password" label="New password" icon={<Lock size={24} />} type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
        <Field id="confirm" label="Confirm password" icon={<Lock size={24} />} type="password" placeholder="Type it again" autoComplete="new-password" minLength={8} />
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <Button full type="submit">{busy ? 'Saving…' : 'Save new password'}</Button>
      </form>
    </AuthCard>
  );
}
