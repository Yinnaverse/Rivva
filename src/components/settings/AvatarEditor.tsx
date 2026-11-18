'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { clampOffset, baseScale, drawCrop, EDITOR_BOX, initialCrop, loadImage, renderAvatar, type Crop } from '@/lib/avatar';
import { Button } from '../Button';
import styles from './AvatarEditor.module.css';

/** Pick the part of the picture to use: drag to move, slider to zoom. */
export function AvatarEditor({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<ImageBitmap | HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadImage(file).then((i) => { if (live) { setImg(i); setCrop(initialCrop(i.width, i.height)); } })
      .catch((e) => setError(e instanceof Error ? e.message : 'That picture can’t be opened.'));
    return () => { live = false; };
  }, [file]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (c && ctx && img && crop) drawCrop(ctx, img as CanvasImageSource & { width: number; height: number }, crop, EDITOR_BOX);
  }, [img, crop]);

  const clamp = useCallback((c: Crop): Crop => {
    if (!img) return c;
    const s = baseScale(img.width, img.height) * c.zoom;
    return { zoom: c.zoom, x: clampOffset(c.x, img.width * s), y: clampOffset(c.y, img.height * s) };
  }, [img]);

  function setZoom(zoom: number) {
    if (!img || !crop) return;
    const oldS = baseScale(img.width, img.height) * crop.zoom;
    const newS = baseScale(img.width, img.height) * zoom;
    const cx = (EDITOR_BOX / 2 - crop.x) / oldS; // keep the middle of the box fixed while zooming
    const cy = (EDITOR_BOX / 2 - crop.y) / oldS;
    setCrop(clamp({ zoom, x: EDITOR_BOX / 2 - cx * newS, y: EDITOR_BOX / 2 - cy * newS }));
  }

  async function save() {
    if (!img || !crop) return;
    setBusy(true);
    setError(null);
    try { await onSave(await renderAvatar(img, crop)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the picture'); setBusy(false); }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label="Edit profile picture">
      <div className={styles.sheet}>
        <div className={styles.head}><h2>Profile picture</h2><button type="button" onClick={onCancel} aria-label="Close"><X size={24} /></button></div>
        {error && !img ? <p role="alert" className={styles.error}>{error}</p> : (
          <>
            <div className={styles.stage}>
              <canvas
                ref={canvas} width={EDITOR_BOX} height={EDITOR_BOX} className={styles.canvas}
                onPointerDown={(e) => { if (!crop) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }; }}
                onPointerMove={(e) => { const d = drag.current; if (!d || !crop) return; setCrop(clamp({ zoom: crop.zoom, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py })); }}
                onPointerUp={() => { drag.current = null; }}
              />
              <div className={styles.ring} aria-hidden />
            </div>
            <label className={styles.zoom}>
              <span>Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={crop?.zoom ?? 1} onChange={(e) => setZoom(parseFloat(e.target.value))} aria-label="Zoom" />
            </label>
            <p className={styles.hint}>Drag the picture to move it. It’s saved as a small square and shown to people in your rooms and friends list.</p>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
              <Button onClick={save}>{busy ? 'Saving…' : 'Save picture'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
