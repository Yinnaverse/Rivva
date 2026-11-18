import { supabase } from './supabase';

const BUCKET = 'avatars';
export const AVATAR_OUTPUT = 256; // pixels, square
export const EDITOR_BOX = 240;

export type Crop = { zoom: number; x: number; y: number };

/** Scale that makes the picture just cover the square box at zoom 1. */
export function baseScale(w: number, h: number, box = EDITOR_BOX) {
  return box / Math.min(w, h);
}

/** Keep the picture covering the whole box. */
export function clampOffset(value: number, size: number, box = EDITOR_BOX) {
  return Math.min(0, Math.max(box - size, value));
}

export function initialCrop(w: number, h: number): Crop {
  const s = baseScale(w, h);
  return { zoom: 1, x: (EDITOR_BOX - w * s) / 2, y: (EDITOR_BOX - h * s) / 2 };
}

export function drawCrop(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, crop: Crop, out: number) {
  const k = out / EDITOR_BOX;
  const s = baseScale(img.width, img.height) * crop.zoom;
  ctx.clearRect(0, 0, out, out);
  ctx.drawImage(img, crop.x * k, crop.y * k, img.width * s * k, img.height * s * k);
}

/** Crops to a square, shrinks to 256px and re-encodes. Re-encoding also strips location data from photos. */
export async function renderAvatar(img: ImageBitmap | HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser can’t process images.');
  drawCrop(ctx, img as CanvasImageSource & { width: number; height: number }, crop, AVATAR_OUTPUT);
  for (const [type, quality] of [['image/webp', 0.85], ['image/jpeg', 0.88]] as const) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob && blob.type === type) return blob;
  }
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('Could not prepare the picture.');
  return png;
}

export async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That picture can’t be opened. Try a JPG, PNG or WebP file.'));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function removeAll(userId: string, except?: string) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== except);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

export async function saveAvatar(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`; // new name each time so caches never show the old picture
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw new Error(upErr.message);
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  await removeAll(userId, path);
  return url;
}

export async function removeAvatar(userId: string) {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw new Error(error.message);
  await removeAll(userId);
}

/** Used when deleting an account. */
export async function deleteAvatarFiles(userId: string) {
  await removeAll(userId);
}
