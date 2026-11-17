'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/** Goes back in history, or to a sensible page when this tab has no history (e.g. a shared link). */
export function BackButton({ fallback, label = 'Back' }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', padding: '4px 0', alignSelf: 'flex-start' }}
    >
      <ArrowLeft size={20} /> {label}
    </button>
  );
}
