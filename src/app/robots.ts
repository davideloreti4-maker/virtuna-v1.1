import type { MetadataRoute } from 'next';

/**
 * Next.js metadata robots — Landing v1 (FOUND-10).
 * Auto-served at `/robots.txt`. Allow rules and sitemap link per UI-SPEC § SEO Baseline.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api', '/auth', '/onboarding'],
    },
    sitemap: 'https://virtuna.ai/sitemap.xml',
  };
}
