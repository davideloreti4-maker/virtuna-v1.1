import type { ScrapingProvider, ProfileData, VideoData } from "./types";

export type { ScrapingProvider, ProfileData, VideoData };
export { ApifyScrapingProvider } from "./apify-provider";

/**
 * Create the default scraping provider.
 * Currently returns Apify. Swap this factory to change provider
 * without touching any consumer code.
 */
export function createScrapingProvider(): ScrapingProvider {
  // Lazy import to avoid pulling apify-client into client bundles
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ApifyScrapingProvider } = require("./apify-provider");
  return new ApifyScrapingProvider();
}
