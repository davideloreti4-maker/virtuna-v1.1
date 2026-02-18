/**
 * CJ Affiliate (Commission Junction) API client.
 *
 * Lazy-singleton GraphQL client for product and advertiser search.
 * Gracefully degrades when env vars are missing (returns empty results).
 */

import type { CJProduct } from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CJ_GRAPHQL_ENDPOINT = "https://ads.api.cj.com/query";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return !!(process.env.CJ_API_TOKEN && process.env.CJ_PUBLISHER_ID);
}

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

async function cjQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  const token = process.env.CJ_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(CJ_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.error(`[cj-client] API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors?.length) {
      console.error("[cj-client] GraphQL errors:", json.errors.map((e) => e.message));
      return null;
    }

    return json.data ?? null;
  } catch (err) {
    console.error("[cj-client] Fetch error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Product Search
// ---------------------------------------------------------------------------

interface SearchProductsOptions {
  category?: string;
  limit?: number;
  offset?: number;
}

interface CJProductSearchResponse {
  productSearch: {
    totalCount: number;
    products: Array<{
      adId: string;
      advertiserName: string;
      catalogItem: {
        title: string;
        description: string;
        price: { amount: number; currency: string };
        imageUrl: string;
        buyUrl: string;
        category: string;
      };
    }>;
  };
}

export async function searchProducts(
  keyword: string,
  options: SearchProductsOptions = {}
): Promise<{ products: CJProduct[]; total: number }> {
  if (!isAvailable()) return { products: [], total: 0 };

  const { category, limit = 20, offset = 0 } = options;
  const cacheKey = `products:${keyword}:${category ?? "all"}:${limit}:${offset}`;

  const cached = getCached<{ products: CJProduct[]; total: number }>(cacheKey);
  if (cached) return cached;

  const publisherId = process.env.CJ_PUBLISHER_ID;
  const categoryFilter = category ? `category: "${category}"` : "";

  const query = `
    query ProductSearch {
      productSearch(
        companyId: "${publisherId}"
        keywords: "${keyword.replace(/"/g, '\\"')}"
        limit: ${limit}
        offset: ${offset}
        ${categoryFilter}
      ) {
        totalCount
        products {
          adId
          advertiserName
          catalogItem {
            title
            description
            price { amount currency }
            imageUrl
            buyUrl
            category
          }
        }
      }
    }
  `;

  const data = await cjQuery<CJProductSearchResponse>(query);
  if (!data?.productSearch) return { products: [], total: 0 };

  const products: CJProduct[] = data.productSearch.products.map((p) => ({
    adId: p.adId,
    advertiserName: p.advertiserName,
    productName: p.catalogItem.title,
    description: p.catalogItem.description,
    price: p.catalogItem.price.amount,
    currency: p.catalogItem.price.currency,
    imageUrl: p.catalogItem.imageUrl || undefined,
    buyUrl: p.catalogItem.buyUrl,
    category: p.catalogItem.category,
  }));

  const result = { products, total: data.productSearch.totalCount };
  setCache(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Advertiser Search
// ---------------------------------------------------------------------------

interface CJAdvertiserSearchResponse {
  advertiserSearch: {
    advertisers: Array<{
      advertiserId: string;
      advertiserName: string;
      programUrl: string;
      categories: string[];
    }>;
  };
}

interface CJAdvertiser {
  id: string;
  name: string;
  programUrl: string;
  categories: string[];
}

export async function searchAdvertisers(keyword: string): Promise<CJAdvertiser[]> {
  if (!isAvailable()) return [];

  const cacheKey = `advertisers:${keyword}`;
  const cached = getCached<CJAdvertiser[]>(cacheKey);
  if (cached) return cached;

  const publisherId = process.env.CJ_PUBLISHER_ID;

  const query = `
    query AdvertiserSearch {
      advertiserSearch(
        companyId: "${publisherId}"
        keywords: "${keyword.replace(/"/g, '\\"')}"
        limit: 20
      ) {
        advertisers {
          advertiserId
          advertiserName
          programUrl
          categories
        }
      }
    }
  `;

  const data = await cjQuery<CJAdvertiserSearchResponse>(query);
  if (!data?.advertiserSearch) return [];

  const advertisers: CJAdvertiser[] = data.advertiserSearch.advertisers.map((a) => ({
    id: a.advertiserId,
    name: a.advertiserName,
    programUrl: a.programUrl,
    categories: a.categories,
  }));

  setCache(cacheKey, advertisers);
  return advertisers;
}
