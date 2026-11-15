import { supabase } from './supabase';
import type { DbRoom, RoomListItem } from './types';

export async function listRooms(): Promise<RoomListItem[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(display_name), room_members(user_id, profiles(display_name))')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoomListItem[];
}

export async function createRoom(): Promise<DbRoom> {
  const { data, error } = await supabase.rpc('create_room');
  if (error) throw new Error(error.message);
  return data as DbRoom;
}

export async function joinRoom(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_room', { p_room: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function joinRoomByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code });
  if (error) throw new Error(error.message);
  return data as string;
}
