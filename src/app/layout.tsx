import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit';
import './globals.css';
import { AuthProvider } from '@/lib/AuthProvider';

export const metadata: Metadata = {
  title: 'Rivva',
  description: 'Watch together. Even when apart.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
