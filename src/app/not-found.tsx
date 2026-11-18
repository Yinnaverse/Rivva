import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { BRAND } from '@/lib/brand';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', gap: 16, textAlign: 'center', padding: 24, justifyItems: 'center' }}>
      <Logo size={48} />
      <h1 style={{ fontSize: 28, fontWeight: 500 }}>Page not found</h1>
      <p style={{ color: 'var(--muted)' }}>That page doesn’t exist, or the link has changed.</p>
      <Button href="/">Back to {BRAND.name}</Button>
    </main>
  );
}
