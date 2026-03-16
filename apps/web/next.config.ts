import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Type-checking is handled separately (pnpm type-check) before the build.
    // Next.js's built-in checker fails in Docker due to pnpm workspace symlink resolution.
    ignoreBuildErrors: true,
  },
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
