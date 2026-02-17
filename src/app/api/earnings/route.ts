import { createClient } from "@/lib/supabase/server";

interface MonthlyBreakdown {
  month: string;
  amount: number;
}

interface TopSource {
  brandName: string;
  brandLogo: string;
  totalEarned: number;
  clicks: number;
  conversions: number;
  dealCount: number;
}

/**
 * GET /api/earnings
 *
 * Aggregates earnings from the authenticated user's affiliate_links.
 * All amounts returned in cents.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: links, error } = await supabase
      .from("affiliate_links")
      .select("earnings_cents, product_name, created_at, status, clicks, conversions")
      .eq("user_id", user.id);

    if (error) {
      console.error("[earnings] Query error:", error);
      return Response.json(
        { error: "Failed to fetch earnings" },
        { status: 500 }
      );
    }

    const rows = (links as unknown as Array<{
      earnings_cents: number;
      product_name: string;
      created_at: string;
      status: string;
      clicks: number;
      conversions: number;
    }>) ?? [];

    // Total earned across all links
    const totalEarned = rows.reduce(
      (sum, r) => sum + (r.earnings_cents ?? 0),
      0
    );

    // Pending = earnings from active links (not yet paid out)
    const pendingPayout = rows
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + (r.earnings_cents ?? 0), 0);

    // This month's earnings
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const thisMonth = rows
      .filter((r) => r.created_at?.startsWith(currentMonth))
      .reduce((sum, r) => sum + (r.earnings_cents ?? 0), 0);

    // Monthly breakdown
    const monthMap = new Map<string, number>();
    for (const r of rows) {
      if (!r.created_at) continue;
      const month = r.created_at.slice(0, 7); // "YYYY-MM"
      monthMap.set(month, (monthMap.get(month) ?? 0) + (r.earnings_cents ?? 0));
    }
    const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    // Top sources aggregated by product name
    const sourceMap = new Map<
      string,
      { totalEarned: number; clicks: number; conversions: number; count: number }
    >();
    for (const r of rows) {
      const existing = sourceMap.get(r.product_name) ?? {
        totalEarned: 0,
        clicks: 0,
        conversions: 0,
        count: 0,
      };
      existing.totalEarned += r.earnings_cents ?? 0;
      existing.clicks += r.clicks ?? 0;
      existing.conversions += r.conversions ?? 0;
      existing.count += 1;
      sourceMap.set(r.product_name, existing);
    }
    const topSources: TopSource[] = Array.from(sourceMap.entries())
      .sort(([, a], [, b]) => b.totalEarned - a.totalEarned)
      .slice(0, 5)
      .map(([name, agg]) => ({
        brandName: name,
        brandLogo: "",
        totalEarned: agg.totalEarned,
        clicks: agg.clicks,
        conversions: agg.conversions,
        dealCount: agg.count,
      }));

    return Response.json({
      totalEarned,
      pendingPayout,
      thisMonth,
      monthlyBreakdown,
      topSources,
    });
  } catch (error) {
    console.error("[earnings] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
