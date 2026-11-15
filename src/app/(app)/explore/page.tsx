import { MovieCard } from '@/components/MovieCard';
import { catalogue } from '@/lib/mock';

export default function ExplorePage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 500 }}>Explore Content</h1>
      {catalogue.map((m) => <MovieCard key={m.id} movie={m} />)}
    </section>
  );
}
