import { Lobby } from '@/components/lobby/Lobby';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Lobby roomId={id} />;
}
