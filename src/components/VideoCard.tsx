import { Clock, Heart, User } from 'lucide-react';
import type { LibraryVideo } from '@/lib/library';
import { formatClock } from '@/lib/videos';
import { Button } from './Button';
import styles from './VideoCard.module.css';

function hueOf(text: string) {
  let h = 7;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
  return h % 360;
}

export function VideoCard({
  video, mine, busy, onWatch, onToggleSave,
}: { video: LibraryVideo; mine: boolean; busy: boolean; onWatch: () => void; onToggleSave: () => void }) {
  const hue = hueOf(video.title);
  return (
    <article className={styles.card}>
      <div
        className={styles.poster}
        style={{ background: `linear-gradient(160deg, hsl(${hue} 70% 38%), hsl(${hue} 60% 8%))` }}
        role="img" aria-label={`${video.title} poster`}
      >
        <span>{video.title}</span>
      </div>
      <h3 className={styles.title}>{video.title}</h3>
      <div className={styles.meta}>
        <span className={styles.metaItem}><User size={18} /> {mine ? 'Your upload' : `Shared by ${video.owner?.display_name ?? 'someone'}`}</span>
        <span className={styles.metaItem}><Clock size={18} /> {video.duration_seconds ? formatClock(video.duration_seconds) : video.source_url ? 'Link' : 'Video'}</span>
      </div>
      <div className={styles.actions}>
        <Button onClick={onWatch}>{busy ? 'Starting…' : 'Select & Watch'}</Button>
        <button type="button" className={styles.like} onClick={onToggleSave} aria-pressed={video.saved} aria-label={video.saved ? `Remove ${video.title} from saved` : `Save ${video.title}`}>
          <Heart size={24} fill={video.saved ? 'var(--accent)' : 'none'} color={video.saved ? 'var(--accent)' : 'currentColor'} />
        </button>
      </div>
    </article>
  );
}
