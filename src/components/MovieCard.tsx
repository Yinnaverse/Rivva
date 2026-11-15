import { Clock, Heart, Star } from 'lucide-react';
import type { Movie } from '@/lib/mock';
import { Button } from './Button';
import styles from './MovieCard.module.css';

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <article className={styles.card}>
      <div
        className={styles.poster}
        style={{ background: `linear-gradient(160deg, hsl(${movie.hue} 70% 38%), hsl(${movie.hue} 60% 8%))` }}
        role="img"
        aria-label={`${movie.title} poster`}
      >
        <span>{movie.title}</span>
      </div>
      <h3 className={styles.title}>{movie.title}</h3>
      <p className={styles.muted}>{movie.genre}</p>
      <p className={styles.muted}>{movie.blurb}</p>
      <div className={styles.meta}>
        <span className={styles.metaItem}><Star size={20} fill="#f5c518" stroke="#f5c518" /> {movie.rating} / 5</span>
        <span className={styles.metaItem}><Clock size={20} /> {movie.duration}</span>
      </div>
      <div className={styles.actions}>
        <Button href={`/rooms?movie=${movie.id}`}>Select &amp; Watch</Button>
        <button type="button" className={styles.like} aria-label={`Save ${movie.title}`}>
          <Heart size={24} />
        </button>
      </div>
    </article>
  );
}
