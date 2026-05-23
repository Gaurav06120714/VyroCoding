import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vyro/types'],
  experimental: {
    // Enable server actions
  },
};

export default nextConfig;
