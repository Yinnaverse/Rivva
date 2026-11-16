import styles from './Avatar.module.css';

const hues = [140, 200, 28, 270, 330, 60];

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const hue = hues[name.charCodeAt(0) % hues.length];
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 45% 32%)` }}
      aria-label={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ names, size = 30 }: { names: string[]; size?: number }) {
  return (
    <span className={styles.stack}>
      {names.map((n, i) => (
  <Avatar key={`${i}-${n}`} name={n} size={size} />
))}
    </span>
  );
}
