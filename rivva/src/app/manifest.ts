import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rivva',
    short_name: 'Rivva',
    description: 'Watch together. Even when apart.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#d6273e',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
