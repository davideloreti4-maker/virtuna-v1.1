/**
 * POST /api/remix/adapt
 *
 * Accepts a decoded structural anatomy + niche, generates exactly 3 niche-adapted
 * concepts via the Qwen-only adapt generator, and persists them into
 * variants.remix.adapt without clobbering variants.craft or variants.remix.decode (Pitfall 2).
 *
 * Security controls (ADAPT security V2, ASVS V2/V4):
 *  T-04-03 — auth gate: getUser() → 401 before any LLM/DB work
 *  T-04-04 — content-leak guard: AdaptRequestSchema has no luck[]/caption keys (D-01)
 *  T-04-05 — ownership: select user_id → 404 before write
 *  T-04-06 — body validation: AdaptRequestSchema.safeParse → 400; niche .max(200)
 *  T-04-07 — CSRF: Content-Type 415 + cross-origin 403 guards
 */

import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import type { Json } from "@/types/database.types";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptInput } from "@/lib/engine/remix/decode-types";

// =====================================================================
// Request schema — luck[] is NOT included (D-01 structural guard at wire)
// =====================================================================

const AdaptRequestSchema = z.object({
  // Analysis ids are url-safe nanoids (nanoid(12)), NOT UUIDs — the previous
  // .uuid() rejected every real id with a 400 (e.g. "KSW5TluyRy0L"). Matches the
  // convention in analyze/[id]/{filmstrips,script,comparisons} routes.
  analysis_id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u, 'analysis_id must be a url-safe id'),
  decode: z.object({
    hook_pattern:   z.string().min(1),
    structure:      z.string().min(1),
    the_turn:       z.string().min(1),
    emotional_beat: z.string().min(1),
    repeatable:     z.array(
      z.object({
        label:           z.string(),
        why_repeatable:  z.string(),
      }),
    ),
    // luck[] NOT in schema — D-01 structural guard at the wire (T-04-04)
  }),
  niche: z.string().min(1).max(200),
});

// =====================================================================
// Route config — adapt generation (qwen3.6-plus) measures ~65s live, so the
// platform default (~60s) would 504 mid-generation. Match the analyze route's
// budget. This was never set because the adapt route never ran live end-to-end
// (the upstream remix→decode pipeline was failing first).
// =====================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cost-exhaustion guard (mirrors /api/analyze DAILY_LIMITS). Adapt is a billable
// qwen3.6-plus call (~65s); without this gate an authed user can replay any owned
// analysis_id unboundedly. Adapt consumes the same daily budget as an analysis.
const DAILY_LIMITS: Record<string, number> = {
  free: 50,
  starter: 50,
  pro: Infinity,
};

// =====================================================================
// POST handler
// =====================================================================

export async function POST(request: Request): Promise<Response> {
  const requestId = nanoid(12);
  const log = createLogger({ requestId, module: "api.remix.adapt" });

  try {
    // ----------------------------------------------------------------
    // 1. Auth gate — MUST be first (T-04-03, ASVS V2)
    // ----------------------------------------------------------------
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ----------------------------------------------------------------
    // 2. Content-Type 415 guard (T-04-07, WR-05 pattern)
    // ----------------------------------------------------------------
    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      ?.toLowerCase();
    if (contentType !== "application/json") {
      return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
    }

    // ----------------------------------------------------------------
    // 3. Cross-origin 403 guard (T-04-07, CSRF — creator-profile pattern)
    // ----------------------------------------------------------------
    const origin = request.headers.get("origin");
    if (origin) {
      const url = new URL(request.url);
      const expectedOrigin = `${url.protocol}//${url.host}`;
      if (origin !== expectedOrigin) {
        return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
      }
    }

    // ----------------------------------------------------------------
    // 4. Zod body validation — 400 on invalid (T-04-06)
    // ----------------------------------------------------------------
    const body = await request.json() as unknown;
    const parsed = AdaptRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { analysis_id, decode, niche } = parsed.data;

    // ----------------------------------------------------------------
    // 5. Ownership check — 404 before any write (T-04-05, ASVS V4)
    // ----------------------------------------------------------------
    const service = createServiceClient();
    const { data: ownerRow, error: ownerErr } = await service
      .from("analysis_results")
      .select("user_id")
      .eq("id", analysis_id)
      .single();

    if (ownerErr || !ownerRow || ownerRow.user_id !== user.id) {
      log.warn("adapt ownership check failed", {
        analysis_id,
        user_id: user.id,
        error: ownerErr?.message,
      });
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // ----------------------------------------------------------------
    // 5b. Rate-limit gate — cost-exhaustion guard before the LLM call.
    //     Reads the same daily counter as /api/analyze so replaying an owned
    //     analysis_id cannot trigger unbounded billable adapt generations.
    // ----------------------------------------------------------------
    const { data: subscription } = await service
      .from("user_subscriptions")
      .select("virtuna_tier")
      .eq("user_id", user.id)
      .single();
    const tier = (subscription?.virtuna_tier as string) || "free";

    const today = new Date().toISOString().split("T")[0]!;
    const { data: usage } = await service
      .from("usage_tracking")
      .select("analysis_count")
      .eq("user_id", user.id)
      .eq("period_start", today)
      .eq("period_type", "daily")
      .single();
    const currentCount = usage?.analysis_count ?? 0;

    const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free!;
    if (currentCount >= limit) {
      log.warn("adapt daily limit reached", { user_id: user.id, currentCount, limit, tier });
      return Response.json(
        { error: "Daily limit reached", limit, tier, reset: "midnight UTC" },
        { status: 429 },
      );
    }

    // ----------------------------------------------------------------
    // 6. Build AdaptInput + call generator
    // ----------------------------------------------------------------
    const adaptInput: AdaptInput = {
      hook_pattern:   decode.hook_pattern,
      structure:      decode.structure,
      the_turn:       decode.the_turn,
      emotional_beat: decode.emotional_beat,
      repeatable:     decode.repeatable,
      niche,
    };

    const concepts = await generateAdaptConcepts(adaptInput);

    if (!concepts) {
      log.error("adapt generation returned null", { analysis_id });
      return Response.json({ error: "Adapt generation failed" }, { status: 500 });
    }

    // ----------------------------------------------------------------
    // 7. Read-merge-write into variants.remix.adapt (Pitfall 2 guard)
    //    MUST spread current AND current.remix to preserve craft + decode
    // ----------------------------------------------------------------
    const { data: variantsRow, error: readErr } = await service
      .from("analysis_results")
      .select("variants")
      .eq("id", analysis_id)
      .single();

    if (readErr || !variantsRow) {
      log.warn("adapt variants read failed", { analysis_id, error: readErr?.message });
      return Response.json({ error: "Failed to read analysis row" }, { status: 500 });
    }

    const current      = (variantsRow.variants ?? {}) as Record<string, unknown>;
    const currentRemix = (current.remix ?? {}) as Record<string, unknown>;

    const { error: writeErr } = await service
      .from("analysis_results")
      .update({
        variants: {
          ...current,
          remix: {
            ...currentRemix,
            adapt: concepts,
          },
        } as unknown as Json,
      })
      .eq("id", analysis_id);

    if (writeErr) {
      log.warn("adapt variants write failed", { analysis_id, error: writeErr.message });
      return Response.json({ error: "Failed to persist adapt concepts" }, { status: 500 });
    }

    // Consume daily budget — increment AFTER successful generation + persist, same
    // counter /api/analyze uses, so the 5b gate actually bounds replay attempts.
    await service.from("usage_tracking").upsert(
      {
        user_id: user.id,
        period_start: today,
        period_type: "daily",
        analysis_count: currentCount + 1,
      },
      { onConflict: "user_id,period_start,period_type" },
    );

    log.info("adapt concepts persisted", { analysis_id, count: concepts.length });
    return Response.json({ concepts });

  } catch (err) {
    Sentry.captureException(err, { tags: { route: "api.remix.adapt" } });
    log.error("adapt route threw", { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
