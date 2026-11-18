import { Clapperboard, Globe, Lock, Users } from 'lucide-react';
import type { RoomListItem } from '@/lib/types';
import { AvatarStack } from './Avatar';
import { Button } from './Button';
import styles from './RoomCard.module.css';

export function RoomCard({ room, isMember, onOpen }: { room: RoomListItem; isMember: boolean; onOpen: () => void }) {
  const playing = room.status === 'playing';
  const people = room.room_members.map((m) => ({ name: m.profiles?.display_name ?? 'Guest', src: m.profiles?.avatar_url }));
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.name}>
          {room.name}
          {room.is_private ? <Lock size={18} color="#f5a623" aria-label="Private room" /> : <Globe size={22} aria-label="Public room" />}
        </h3>
        <span className={`${styles.badge} ${playing ? styles.playing : styles.waiting}`}>
          {playing ? 'Now Playing' : 'Waiting'}
        </span>
      </div>
      {room.description && <p className={styles.muted}>{room.description}</p>}
      <p className={styles.muted}>Hosted by <span className={styles.host}>{room.host?.display_name ?? 'Guest'}</span></p>
      <p className={styles.now}><Clapperboard size={16} /> {room.now_playing ?? 'Unselected'}</p>
      <div className={styles.people}>
        <AvatarStack people={people.slice(0, 5)} />
        <span className={styles.count}><Users size={16} /> {people.length}/{room.capacity}</span>
      </div>
      <Button full onClick={onOpen}>{isMember ? 'Open Room' : 'Join Room'}</Button>
    </article>
  );
}
