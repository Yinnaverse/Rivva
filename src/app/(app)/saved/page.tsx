import { VideoList } from '@/components/VideoList';

export default function SavedPage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <h1 style={{ fontSize: 32, fontWeight: 500 }}>Saved Content</h1>
      <VideoList mode="saved" />
    </section>
  );
}
