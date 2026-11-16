'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shows /public/logo.svg (your exported Yinnaverse mark). Until that file exists,
 * it falls back to a simple placeholder mark.
 */
export function Logo({ size = 40 }: { size?: number }) {
  const [custom, setCustom] = useState(true);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setCustom(false);
  }, []);

  if (custom) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={img} src="/logo.svg" alt="Rivva" style={{ height: size, width: 'auto', display: 'block' }} onError={() => setCustom(false)} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Rivva">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path d="M22 16h13a10 10 0 0 1 3 19.6L44 48h-9l-5-10h-4v10h-8V16Zm8 8v6h5a3 3 0 0 0 0-6h-5Z" fill="#fff" />
    </svg>
  );
}
