import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { THEME_BOOT_SCRIPT } from '@/lib/themeBoot';

export const metadata: Metadata = {
  title: 'Hide + Seek',
  description: 'Jet Lag: The Game style Hide + Seek on your city’s public transit — live tracking, question deck, curses and chat.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Hide + Seek' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#152230' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1118' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Overpass:wght@400;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
