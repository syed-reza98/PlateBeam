import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    menuCatalog: {
      stale: 60,
      revalidate: 300,
      expire: 3600,
    },
    analyticsLive: {
      stale: 10,
      revalidate: 30,
      expire: 120,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
