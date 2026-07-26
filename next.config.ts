import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Dev RAM: `--max-old-space-size` caps ONLY the V8 JS heap. `next dev --turbopack`
  // runs a native Rust bundler whose module graph lives outside V8, so a 2GB heap cap
  // still showed 3.66GB RSS. `turbopackMemoryLimit` (bytes) is the only knob that caps
  // Turbopack's native arena — it evicts cache as it nears the target. Trade: slightly
  // slower rebuilds for a bounded footprint (multiple dev servers on a 16GB machine).
  experimental: {
    turbopackMemoryLimit: 1.5 * 1024 * 1024 * 1024, // 1.5GB native cap
  },
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
