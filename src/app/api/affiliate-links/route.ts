import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createLinkSchema = z.object({
  deal_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1).max(200),
  url: z.string().url(),
  short_code: z.string().min(1).max(50),
  commission_rate_pct: z.number().min(0).max(100),
});

/**
 * GET /api/affiliate-links
 *
 * Returns the authenticated user's affiliate links.
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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[affiliate-links] Query error:", error);
      return Response.json(
        { error: "Failed to fetch affiliate links" },
        { status: 500 }
      );
    }

    return Response.json({ data: links ?? [] });
  } catch (error) {
    console.error("[affiliate-links] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/affiliate-links
 *
 * Creates a new affiliate link for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createLinkSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { deal_id, product_name, url, short_code, commission_rate_pct } =
      parsed.data;

    const { data: link, error } = await supabase
      .from("affiliate_links")
      .insert({
        user_id: user.id,
        deal_id: deal_id ?? null,
        product_name,
        url,
        short_code,
        commission_rate_pct,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint on short_code
      if (error.code === "23505") {
        return Response.json(
          { error: "Short code already taken" },
          { status: 409 }
        );
      }
      console.error("[affiliate-links] Insert error:", error);
      return Response.json(
        { error: "Failed to create affiliate link" },
        { status: 500 }
      );
    }

    return Response.json(link, { status: 201 });
  } catch (error) {
    console.error("[affiliate-links] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
