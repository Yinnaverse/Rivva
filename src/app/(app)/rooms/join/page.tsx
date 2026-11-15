import { Suspense } from 'react';
import { JoinRoomForm } from '@/components/JoinRoomForm';

export default function JoinRoomPage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 500 }}>Join a Room</h1>
      <p style={{ color: 'var(--muted)' }}>Enter the 6-character code your friend shared.</p>
      <Suspense>
        <JoinRoomForm />
      </Suspense>
    </section>
  );
}
