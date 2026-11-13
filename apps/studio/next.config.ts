import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@press/ui', '@press/db'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
