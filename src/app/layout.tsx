import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit';
import './globals.css';
import { AuthProvider } from '@/lib/AuthProvider';
import { NotificationsProvider } from '@/lib/NotificationsProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <NotificationsProvider>{children}</NotificationsProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
