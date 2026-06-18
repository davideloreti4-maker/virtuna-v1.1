/**
 * GET /api/audiences   — list all audiences for the authenticated user
 * POST /api/audiences  — create a new audience
 *
 * Security (STRIDE T-07-01 – T-07-04):
 *  - Auth-first: getUser() before any DB read (CR-01 / T-07-03)
 *  - Session user_id only — never from body (T-07-03)
 *  - Zod validates body shape + weights sum ≈ 1.0 ±0.01 (T-07-01)
 *  - sanitizeText applied to goal_label + name (T-07-04)
 *  - Generic error codes; never echo raw input (T-07-04)
 *  - RLS enforced at DB layer (T-07-02); also enforced app-layer via audience-repo
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  listAudiences,
  createAudience,
} from "@/lib/audience/audience-repo";

// ─── Input validation ──────────────────────────────────────────────────────────

const WeightsSchema = z
  .object({
    fyp: z.number().min(0).max(1),
    niche: z.number().min(0).max(1),
    loyalist: z.number().min(0).max(1),
    cross_niche: z.number().min(0).max(1),
  })
  .refine(
    (w) => Math.abs(w.fyp + w.niche + w.loyalist + w.cross_niche - 1) < 0.01,
    { message: "Audience weights must sum to 1.0 (±0.01)" },
  );

/**
 * Sanitize free-text input: trim whitespace, strip control characters.
 * Prevents injection of control chars into DB / prompts (T-07-04).
 */
function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

const CreateAudienceSchema = z.object({
  name: z.string().min(1).max(80).transform(sanitizeText),
  type: z.enum(["personal", "target"]),
  platform: z.enum(["tiktok", "instagram", "youtube", "custom"]),
  goal_label: z.string().max(120).transform(sanitizeText).nullable().optional(),
  goal_intent: z.enum(["grow", "sell", "authority", "nurture"]).nullable().optional(),
  persona_weights: WeightsSchema.optional(),
  personas: z.array(z.unknown()).optional(),
  profile: z.unknown().nullable().optional(),
  calibration: z.unknown().nullable().optional(),
});

// ─── GET /api/audiences ────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const audiences = await listAudiences(supabase);
    return NextResponse.json({ audiences });
  } catch {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

// ─── POST /api/audiences ───────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateAudienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_audience_input" }, { status: 400 });
  }

  try {
    // user_id is injected from session inside createAudience (CR-01)
    const audience = await createAudience(supabase, parsed.data);
    return NextResponse.json({ audience }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
