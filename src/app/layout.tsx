import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { ToastRegion } from '@/components/ui/ToastRegion';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PlateBeam OS — Restaurant OS, POS, KDS & QR Ordering',
    template: '%s | PlateBeam OS',
  },
  description:
    'Multi-tenant Restaurant Management, Zero-App QR Ordering, FOH POS, Kitchen Display System, and Owner Analytics.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PlateBeam OS',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
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
      <body className="min-h-dvh bg-[var(--pb-canvas)] font-sans text-[var(--pb-ink)] antialiased selection:bg-[#FF5412]/35 selection:text-white">
        {children}
        <ToastRegion />
      </body>
    </html>
  );
}
