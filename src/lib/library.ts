import { supabase } from './supabase';
import { chooseForRoom } from './videos';
import { createRoom } from './rooms';
import type { Video } from './types';

export type LibraryVideo = Video & { owner: { display_name: string } | null; saved: boolean };

const SELECT = '*, owner:profiles!videos_owner_id_fkey(display_name)';

async function savedIds(): Promise<Set<string>> {
  const { data } = await supabase.from('saved_videos').select('video_id');
  return new Set(((data ?? []) as { video_id: string }[]).map((r) => r.video_id));
}

/** Videos you own plus everything shared to the library; or only the ones you saved. */
export async function listLibrary(userId: string, opts: { savedOnly?: boolean; limit?: number } = {}): Promise<LibraryVideo[]> {
  const saved = await savedIds();
  let rows: Omit<LibraryVideo, 'saved'>[] = [];

  if (opts.savedOnly) {
    if (saved.size === 0) return [];
    const { data, error } = await supabase.from('videos').select(SELECT).in('id', [...saved]).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    rows = (data ?? []) as unknown as Omit<LibraryVideo, 'saved'>[];
  } else {
    let q = supabase.from('videos').select(SELECT).or(`is_shared.eq.true,owner_id.eq.${userId}`).order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows = (data ?? []) as unknown as Omit<LibraryVideo, 'saved'>[];
  }
  return rows.map((v) => ({ ...v, saved: saved.has(v.id) }));
}

export async function setSaved(videoId: string, saved: boolean) {
  const { error } = saved
    ? await supabase.from('saved_videos').insert({ video_id: videoId })
    : await supabase.from('saved_videos').delete().eq('video_id', videoId);
  if (error) throw new Error(error.message);
}

/** Make a new room with this video chosen. Returns the room id. */
export async function startWatchParty(videoId: string): Promise<string> {
  const room = await createRoom();
  await chooseForRoom(room.id, videoId);
  return room.id;
}
