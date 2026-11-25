import type { Metadata } from 'next';
import { Karla, Share_Tech_Mono, Teko } from 'next/font/google';
import type { ReactNode } from 'react';
import { ToastRegion } from '@/components/ui/ToastRegion';
import './globals.css';

const teko = Teko({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-teko',
  display: 'swap',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-karla',
  display: 'swap',
});

const shareTechMono = Share_Tech_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-share-tech-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PlateBeam — Restaurant OS, POS, KDS & QR Ordering',
    template: '%s | PlateBeam',
  },
  description:
    'Multi-tenant Restaurant Management, Zero-App QR Ordering, FOH POS, Kitchen Display System, and Owner Analytics.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PlateBeam',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${teko.variable} ${karla.variable} ${shareTechMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem("color-scheme");if(s==="light"||s==="dark"){document.querySelector('meta[name="color-scheme"]').content=s;}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-[var(--pb-canvas)] font-sans text-[var(--pb-ink)] antialiased">
        {children}
        <ToastRegion />
      </body>
    </html>
  );
}
