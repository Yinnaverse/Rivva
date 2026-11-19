import { HomeActions } from '@/components/HomeActions';
import { InstallBanner } from '@/components/InstallBanner';
import { RoomInvites } from '@/components/RoomInvites';
import { RoomList } from '@/components/RoomList';
import { VideoList } from '@/components/VideoList';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <>
      <RoomInvites />
      <InstallBanner />
      <HomeActions />

      <section className={styles.section}>
        <h2 className={styles.heading}>Trending Now</h2>
        <VideoList mode="library" limit={3} />
      </section>

      <RoomList title="Browse Rooms" />
    </>
  );
}
