import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@playground/shared', '@playground/db'],
  images: {
    remotePatterns: [
      {
        // Twitch avatar CDN — used in the dashboard sidebar
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
