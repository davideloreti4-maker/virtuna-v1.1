import { searchProducts, isAvailable } from "@/lib/affiliate/cj-client";
import type { BrandDealCategory, AffiliateProgram } from "@/types/brand-deals";

/**
 * GET /api/programs/cj?q=fashion&category=clothing&limit=20
 *
 * Proxies CJ Affiliate product search and maps results to AffiliateProgram.
 * Returns { available: false } when CJ env vars are not configured.
 */
export async function GET(request: Request) {
  try {
    if (!isAvailable()) {
      return Response.json({ available: false, data: [], total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const category = searchParams.get("category") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    if (!query.trim()) {
      return Response.json({ available: true, data: [], total: 0 });
    }

    const { products, total } = await searchProducts(query, { category, limit });

    const mapped: AffiliateProgram[] = products.map((p) => ({
      id: `cj-${p.adId}`,
      name: p.advertiserName,
      logo: `https://logo.clearbit.com/${p.advertiserName.toLowerCase().replace(/\s+/g, "")}.com`,
      description: p.productName + (p.description ? ` — ${p.description}` : ""),
      commissionRange: p.commission ? `${p.commission}%` : "Variable",
      type: "network" as const,
      platforms: ["tiktok", "instagram"] as const,
      signUpUrl: p.buyUrl,
      category: mapCJCategory(p.category),
      barrier: "open" as const,
    }));

    return Response.json(
      { available: true, data: mapped, total },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (error) {
    console.error("[api/programs/cj] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Best-effort mapping of CJ category strings to BrandDealCategory.
 */
function mapCJCategory(cjCategory: string): BrandDealCategory {
  const lower = cjCategory.toLowerCase();
  if (lower.includes("fashion") || lower.includes("clothing") || lower.includes("apparel"))
    return "fashion";
  if (lower.includes("beauty") || lower.includes("cosmetic")) return "beauty";
  if (lower.includes("tech") || lower.includes("electronic") || lower.includes("software"))
    return "tech";
  if (lower.includes("fitness") || lower.includes("sport") || lower.includes("health"))
    return "fitness";
  if (lower.includes("game") || lower.includes("gaming")) return "gaming";
  if (lower.includes("food") || lower.includes("grocery") || lower.includes("drink"))
    return "food";
  if (lower.includes("travel") || lower.includes("hotel") || lower.includes("flight"))
    return "travel";
  if (lower.includes("finance") || lower.includes("bank") || lower.includes("invest"))
    return "finance";
  return "tech"; // default fallback
}
