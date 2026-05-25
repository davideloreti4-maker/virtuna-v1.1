import type { MetadataRoute } from 'next';

/**
 * Next.js metadata sitemap — Landing v1 (FOUND-10).
 * Auto-served at `/sitemap.xml`. Canonical URL per UI-SPEC § Copywriting Contract.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://virtuna.ai';
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/#demo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/#pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
