'use client';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', gap: 16, textAlign: 'center', padding: 24, justifyItems: 'center' }}>
      <Logo size={48} />
      <h1 style={{ fontSize: 28, fontWeight: 500 }}>Something went wrong</h1>
      <p style={{ color: 'var(--muted)' }}>Try again. If it keeps happening, go back to the home page.</p>
      <Button onClick={reset}>Try again</Button>
      <a href="/" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>Back to Rivva</a>
    </main>
  );
}
