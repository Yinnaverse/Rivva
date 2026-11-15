import { Suspense } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { RequireAuth } from '@/components/RequireAuth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireAuth>
        <div className="app-frame">
          <AppHeader />
          <main style={{ padding: '0 var(--space-page) calc(var(--nav-height) + 24px)' }}>{children}</main>
          <BottomNav />
        </div>
      </RequireAuth>
    </Suspense>
  );
}
