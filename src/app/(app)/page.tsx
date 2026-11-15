import { HomeActions } from '@/components/HomeActions';
import { MovieCard } from '@/components/MovieCard';
import { RoomList } from '@/components/RoomList';
import { trending } from '@/lib/mock';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <>
      <HomeActions />

      <section className={styles.section}>
        <h2 className={styles.heading}>Trending Now</h2>
        {trending.map((m) => <MovieCard key={m.id} movie={m} />)}
      </section>

      <RoomList title="Browse Rooms" />
    </>
  );
}
