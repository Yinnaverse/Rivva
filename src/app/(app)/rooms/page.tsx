import { HomeActions } from '@/components/HomeActions';
import { RoomList } from '@/components/RoomList';

export default function RoomsPage() {
  return (
    <>
      <HomeActions />
      <RoomList title="Your Rooms" only="mine" />
    </>
  );
}
