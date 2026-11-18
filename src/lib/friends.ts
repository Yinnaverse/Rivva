import { supabase } from './supabase';

export type Person = { id: string; display_name: string; username: string | null; avatar_url: string | null };
export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  requester: Person | null;
  addressee: Person | null;
};
export type Invite = { id: string; room_id: string; room_name: string; created_at: string; inviter: { display_name: string } | null };

const PERSON = 'id, display_name, username, avatar_url';

export async function listFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(`id, requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(${PERSON}), addressee:profiles!friendships_addressee_id_fkey(${PERSON})`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Friendship[];
}

export function otherPerson(f: Friendship, me: string): Person | null {
  return f.requester_id === me ? f.addressee : f.requester;
}

export async function sendFriendRequest(username: string): Promise<'sent' | 'accepted'> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_username: username.trim().replace(/^@/, '') });
  if (error) throw new Error(error.message);
  return data as 'sent' | 'accepted';
}

export async function respondToRequest(id: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept });
  if (error) throw new Error(error.message);
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function inviteFriend(roomId: string, friendId: string) {
  const { error } = await supabase.rpc('invite_friend', { p_room: roomId, p_friend: friendId });
  if (error) throw new Error(error.message);
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('room_invites')
    .select('id, room_id, room_name, created_at, inviter:profiles!room_invites_inviter_id_fkey(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Invite[];
}

export async function acceptInvite(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { p_invite: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function dismissInvite(id: string) {
  const { error } = await supabase.from('room_invites').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
