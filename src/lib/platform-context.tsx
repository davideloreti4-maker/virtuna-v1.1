'use client';

/**
 * PlatformContext — React context for the current platform selection.
 *
 * Used by IdeaCardRenderer to read the active platform when firing the
 * "Develop this →" CTA (POST /api/tools/ideas/develop). Avoids threading
 * a platform prop through MessageBlocks (which only passes block to renderers).
 *
 * Default: "tiktok" (matches the server-side fallback in /api/tools/ideas/develop).
 */

import { createContext, useContext } from 'react';
import type { Platform } from '@/components/app/home/platform-chip';

export const PlatformContext = createContext<Platform>('tiktok');

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
