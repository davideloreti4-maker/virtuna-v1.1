import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Phase 3 (D-09 / RESEARCH Pitfall 1): externalize ffmpeg-static so its __dirname
  // resolves to node_modules at runtime, not the bundled .next directory.
  serverExternalPackages: ['ffmpeg-static'],
  transpilePackages: ['three'],
  webpack: (config) => {
    const externals = Array.isArray(config.externals)
      ? config.externals
      : config.externals
        ? [config.externals]
        : [];
    externals.push({ canvas: 'canvas' });
    config.externals = externals;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
    ],
  },
};

const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
    });
