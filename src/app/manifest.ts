import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#d6273e',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
