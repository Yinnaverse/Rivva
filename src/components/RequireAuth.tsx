'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (!loading && !session) {
      const next = encodeURIComponent(pathname + (search ? `?${search}` : ''));
      router.replace(`/login?next=${next}`);
    }
  }, [loading, session, router, pathname, search]);

  if (loading || !session) return null;
  return <>{children}</>;
}
