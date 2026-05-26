import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
