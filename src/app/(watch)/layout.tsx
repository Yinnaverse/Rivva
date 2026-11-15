import { Suspense } from 'react';
import { RequireAuth } from '@/components/RequireAuth';

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireAuth>{children}</RequireAuth>
    </Suspense>
  );
}
