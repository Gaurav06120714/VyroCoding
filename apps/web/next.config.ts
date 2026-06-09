import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vyro/types'],
  
  output: 'standalone',
  experimental: {
    
  },
};

export default nextConfig;
