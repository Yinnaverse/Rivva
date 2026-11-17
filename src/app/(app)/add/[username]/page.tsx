import { AddFriend } from '@/components/AddFriend';

export default async function AddPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <AddFriend username={decodeURIComponent(username)} />;
}
