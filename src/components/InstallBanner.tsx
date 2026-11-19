'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone, X } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { detectPlatform, isStandalone } from '@/lib/install';
import styles from './InstallBanner.module.css';

const KEY = 'rivva:install-dismissed';

/** On phones that haven't added the app to their home screen yet, a small, dismissible nudge. */
export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }
    setShow(!dismissed && !isStandalone() && detectPlatform() !== 'desktop');
  }, []);

  if (!show) return null;
  return (
    <div className={styles.banner} role="region" aria-label="Add to home screen">
      <Smartphone size={22} color="var(--accent)" />
      <p>Add {BRAND.name} to your home screen for a smoother, full-screen experience. <Link href="/welcome#install">Show me how</Link></p>
      <button type="button" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); }}><X size={20} /></button>
    </div>
  );
}
