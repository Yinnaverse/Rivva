import { VideoList } from '@/components/VideoList';

export default function ExplorePage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 500 }}>Explore Content</h1>
      <VideoList mode="library" />
    </section>
  );
}
