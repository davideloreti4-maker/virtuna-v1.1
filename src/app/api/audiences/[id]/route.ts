/**
 * GET /api/audiences/[id]    — get a single audience
 * PATCH /api/audiences/[id]  — update a single audience
 * DELETE /api/audiences/[id] — delete a single audience (General is refused)
 *
 * Security:
 *  - csrfGuard on mutating methods (PATCH/DELETE) — Content-Type 415 + cross-origin
 *    403, mirroring the tracked-accounts/tools routes (Phase 12 CR-01)
 *  - Auth-first on all methods (T-07-03)
 *  - RLS at DB layer (T-07-02); virtual constants short-circuit via audience-repo
 *  - General/preset sentinel DELETE is explicitly refused (D-04)
 *  - user_id from session only (T-07-03)
 *  - Zod validates PATCH body (T-07-01)
 *  - Generic error codes; never echo raw input (T-07-04)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { Audience } from "@/lib/audience/audience-types";
import {
  getAudience,
  updateAudience,
  deleteAudience,
  SENTINEL_IDS,
} from "@/lib/audience/audience-repo";
import { CalibratedPersonasSchema } from "@/lib/audience/persona-schema";

// ─── Input validation ──────────────────────────────────────────────────────────

function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

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

const PatchAudienceSchema = z
  .object({
    name: z.string().min(1).max(80).transform(sanitizeText).optional(),
    type: z.enum(["personal", "target"]).optional(),
    platform: z.enum(["tiktok", "instagram", "youtube", "custom"]).optional(),
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
    // Element shape validated (shared with the repo gate): `archetype` is the ENGINE BINDING KEY.
    // NOTE this rejects the WHOLE array, and persona-edit-form.tsx PATCHes the full `personas`
    // list (it edits one index and re-sends the siblings) — so a row still holding a bad slug
    // becomes un-editable until repaired. That is intentional: the alternative is to keep
    // accepting a persona the engine will silently ignore. The one such row was repaired with
    // this change (see the migration).
    personas: CalibratedPersonasSchema.optional(),
    profile: z.unknown().nullable().optional(),
    calibration: z.unknown().nullable().optional(),
  })
  .partial();

// ─── GET /api/audiences/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const audience = await getAudience(supabase, id);
    if (!audience) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ audience });
  } catch {
    return NextResponse.json({ error: "get_failed" }, { status: 500 });
  }
}

// ─── PATCH /api/audiences/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // CSRF: Content-Type 415 + cross-origin 403, before any DB work (CR-01).
  const guard = csrfGuard(req);
  if (guard) return guard;

  const { id } = await params;
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

  const parsed = PatchAudienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_audience_input" }, { status: 400 });
  }

  try {
    const audience = await updateAudience(supabase, id, parsed.data as Partial<Audience>);
    return NextResponse.json({ audience });
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// ─── DELETE /api/audiences/[id] ───────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // CSRF: Content-Type 415 + cross-origin 403, before any DB work (CR-01).
  const guard = csrfGuard(req);
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // D-04: virtual/sentinel audiences (General + presets + general templates) have no DB row.
  // Refuse ALL of them at the route layer with a clean 400 — audience-repo also throws, but
  // that surfaces as a generic 500, contradicting the documented refusal contract (WR-05).
  if (SENTINEL_IDS.has(id)) {
    return NextResponse.json(
      { error: "cannot_delete_virtual" },
      { status: 400 },
    );
  }

  try {
    await deleteAudience(supabase, id);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
