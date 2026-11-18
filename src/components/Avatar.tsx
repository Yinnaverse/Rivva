'use client';

import { useEffect, useState } from 'react';
import styles from './Avatar.module.css';

const hues = [140, 200, 28, 270, 330, 60];

export function Avatar({ name, src, size = 30 }: { name: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const hue = hues[name.charCodeAt(0) % hues.length];

  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.avatar} src={src} alt={name} width={size} height={size} loading="lazy" style={{ width: size, height: size, objectFit: 'cover' }} onError={() => setBroken(true)} />;
  }
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 45% 32%)` }} aria-label={name}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ people, size = 30 }: { people: { name: string; src?: string | null }[]; size?: number }) {
  return (
    <span className={styles.stack}>
      {people.map((p, i) => (
        <Avatar key={`${i}-${p.name}`} name={p.name} src={p.src} size={size} />
      ))}
    </span>
  );
}
