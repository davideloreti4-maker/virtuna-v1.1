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
 *  - Ownership: RLS is the primary DB-layer boundary (T-07-02). App layer re-derives the
 *    session user_id on writes (anti-mass-assignment, CR-01) and adds an owner predicate on
 *    update (defense-in-depth, WR-03); reads/deletes by id rely on RLS.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Audience } from "@/lib/audience/audience-types";
import {
  listAudiences,
  createAudience,
} from "@/lib/audience/audience-repo";
import { CalibratedPersonasSchema } from "@/lib/audience/persona-schema";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";

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
  // POP-02 — first-class domain axis (D-04); enum-constrained (mass-assignment guard, T-03-13).
  mode: z.enum(["socials", "general"]).optional(),
  // POP-05 — editable free-text "what good means"; capped + sanitized (stored-XSS bound, T-03-12).
  success_criterion: z.string().max(2000).transform(sanitizeText).nullable().optional(),
  // POP-02/TRUST-02 — user-added grounding: array capped (.max(50), DoS T-03-14); note capped +
  // sanitized (T-03-12); source pinned to the "user" literal. NOT threaded into any scorer (D-02).
  custom_context: z
    .array(
      z.object({
        source: z.literal("user"),
        note: z.string().max(2000).transform(sanitizeText),
        persona_evidence_link: z.string().max(120).optional(),
      }),
    )
    .max(50)
    .optional(),
  persona_weights: WeightsSchema.optional(),
  // Element shape validated (shared with the repo gate): `archetype` is the ENGINE BINDING KEY,
  // so a slug outside the 10 can never bind to a slot and its repaint reaches the model never.
  // Was z.array(z.unknown()) — the deferral (IN-02) that let a hand-written row store `fitness`.
  personas: CalibratedPersonasSchema.optional(),
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
    // The user-level last-used audience (resolveUserAudience) — seeds the composer's selected
    // audience on mount so a page reload no longer resets the presence to General. General
    // (the fallback) maps to null so the client treats it as "no calibrated pin".
    const lastUsed = await resolveUserAudience(supabase, user.id);
    const lastAudienceId = lastUsed.is_general ? null : lastUsed.id;
    return NextResponse.json({ audiences, lastAudienceId });
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
    const audience = await createAudience(supabase, parsed.data as Partial<Audience>);
    return NextResponse.json({ audience }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
