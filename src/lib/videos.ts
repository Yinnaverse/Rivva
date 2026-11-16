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

export const MAX_UPLOAD_MB = 50; // Supabase Free plan limit per file
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Same request supabase-js makes, but through XMLHttpRequest so we get real progress. */
async function uploadWithProgress(path: string, file: Blob, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again to upload.');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', key);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); return; }
      let message = `Upload failed (${xhr.status})`;
      try { message = JSON.parse(xhr.responseText).message ?? message; } catch { /* not JSON */ }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('The connection dropped during the upload. Check your internet and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    xhr.send(body);
  });
}

export async function uploadVideo(
  file: File, title: string, onProgress: (pct: number) => void = () => {}, signal?: AbortSignal,
): Promise<Video> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`That file is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_UPLOAD_MB} MB.`);
  }
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
  try {
    await uploadWithProgress(`${video.id}/${fileName}`, file, onProgress, signal);
  } catch (e) {
    await supabase.from('videos').delete().eq('id', video.id); // don't leave an empty record behind
    throw e;
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
