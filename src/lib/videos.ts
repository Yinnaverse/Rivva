import { supabase } from './supabase';
import { toVtt } from './subtitles';
import type { SubtitleRow, Video } from './types';

const BUCKET = 'videos';

export async function listVideos(): Promise<Video[]> {
  const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Video[];
}

export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

export async function uploadVideo(file: File, title: string): Promise<Video> {
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `video.${ext || 'mp4'}`;
  const duration = await readDuration(file);

  const { data: row, error } = await supabase
    .from('videos')
    .insert({ title, file_name: fileName, mime_type: file.type || null, size_bytes: file.size, duration_seconds: duration })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const video = row as Video;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(`${video.id}/${fileName}`, file, { contentType: file.type || 'video/mp4', upsert: false });
  if (upErr) {
    await supabase.from('videos').delete().eq('id', video.id);
    throw new Error(upErr.message);
  }
  return video;
}

export async function addVideoLink(url: string, title: string): Promise<Video> {
  const { data, error } = await supabase.from('videos').insert({ title, source_url: url }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Video;
}

export async function setShared(id: string, shared: boolean) {
  const { error } = await supabase.from('videos').update({ is_shared: shared }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteVideo(video: Video) {
  if (video.file_name) {
    const { data: subs } = await supabase.from('subtitles').select('path').eq('video_id', video.id);
    const paths = [`${video.id}/${video.file_name}`, ...((subs ?? []) as { path: string }[]).map((s) => s.path)];
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase.from('videos').delete().eq('id', video.id);
  if (error) throw new Error(error.message);
}

export async function addSubtitle(videoId: string, file: File, lang: string, label: string) {
  const vtt = toVtt(await file.text());
  const path = `${videoId}/sub-${lang}.vtt`;
  const blob = new Blob([vtt], { type: 'text/vtt' });
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'text/vtt', upsert: true });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase.from('subtitles').upsert({ video_id: videoId, lang, label, path }, { onConflict: 'video_id,lang' });
  if (error) throw new Error(error.message);
}

export async function listSubtitles(videoId: string): Promise<SubtitleRow[]> {
  const { data } = await supabase.from('subtitles').select('*').eq('video_id', videoId).order('label');
  return (data ?? []) as SubtitleRow[];
}

/** Streaming URL: the pasted link as-is, or a signed URL for an uploaded file. */
export async function getVideoUrl(video: Video): Promise<string> {
  if (video.source_url) return video.source_url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${video.id}/${video.file_name}`, 60 * 60 * 6);
  if (error || !data) throw new Error(error?.message ?? 'Could not open the video');
  return data.signedUrl;
}

/** Subtitle files are fetched and served from a blob URL so they work regardless of CORS. */
export async function getSubtitleUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? 'Could not load subtitles');
  return URL.createObjectURL(new Blob([await data.text()], { type: 'text/vtt' }));
}

export async function chooseForRoom(roomId: string, videoId: string) {
  const { error } = await supabase.rpc('set_room_video', { p_room: roomId, p_video: videoId });
  if (error) throw new Error(error.message);
}

export async function endMovie(roomId: string) {
  const { error } = await supabase.rpc('clear_room_video', { p_room: roomId });
  if (error) throw new Error(error.message);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
