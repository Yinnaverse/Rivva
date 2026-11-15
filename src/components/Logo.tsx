// Placeholder mark — replace with the exported Figma logo asset in /public.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Rivva">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path d="M22 16h13a10 10 0 0 1 3 19.6L44 48h-9l-5-10h-4v10h-8V16Zm8 8v6h5a3 3 0 0 0 0-6h-5Z" fill="#fff" />
    </svg>
  );
}
