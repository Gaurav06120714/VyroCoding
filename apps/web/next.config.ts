import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vyro/types'],
  // Required for Docker production builds — emits a self-contained server.js
  // that can run without the full Next.js install in the runner stage.
  output: 'standalone',
  experimental: {
    // Enable server actions
  },
};

export default nextConfig;
