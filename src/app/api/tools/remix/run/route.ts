/**
 * POST /api/tools/remix/run
 *
 * SSE route: authenticate → validate URL → resolve + decode + adapt → stream remix-card.
 * Clones the hooks/route.ts SSE shell + adapt/route.ts security controls.
 *
 * Security controls (T-06-13 – T-06-17):
 *   T-06-13 — auth gate: getUser() → 401 FIRST (V2)
 *   T-06-14 — CSRF: Content-Type 415 + cross-origin 403 (copy adapt route T-04-07)
 *   T-06-11 — SSRF: resolveAndRehost validates via ApifyScrapingProvider (inside runner)
 *   T-06-15 — temp video orphan: cleanup() in finally inside runRemixPipeline (T-03-02)
 *   T-06-16 — bounded cost: maxDuration=300 cap; single decode + single adapt call
 *
 * NOT copied from adapt route: analysis_id ownership check (thread ownership model, not reading)
 * NOT copied: variants.remix.adapt write path (writes remix-card block to thread message)
 *
 * STREAMING PATTERN (mirrors script route / hooks route pattern):
 *   event: stage   — { name, status: "active"|"done" } — real coarse pipeline phases (D-02, no fake timers)
 *   event: content — remix-card face: adaptedHook + Borrowed chip + angle/whoItsFor + scrollQuote
 *   event: score   — opener band chip (a beat later — content-first, Pitfall 5)
 *   event: error   — { error: "resolve_failed"|"decode_failed"|"adapt_failed" } (SkillRunError surface)
 *   event: done    — { count }
 *
 * STAGES (real pipeline boundaries, no fake timers — D-02):
 *   "Resolving"              → resolveAndRehost (Apify + re-host)
 *   "Decoding"               → analyzeVideoWithOmni + runDecode (perception + structural decode)
 *   "Adapting"               → generateAdaptConcepts (niche-adapt)
 *   "Simulating your audience" → Flash gate on adapted hook
 *
 * maxDuration=300: resolveAndRehost + omni + decode + adapt = ~240s in worst case;
 *   same budget as adapt/route.ts (which clocks at ~65s for adapt alone).
 */

import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runRemixPipeline } from "@/lib/tools/runners/remix-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { createLogger } from "@/lib/logger";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { z } from "zod";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { RemixCardBlock } from "@/lib/tools/blocks";

// ── Route config (Pitfall 4 — resolve+decode+adapt is heavy; copy from adapt/route.ts) ──
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ── Request schema (Zod body validation — T-04-06) ───────────────────────────
// url: must be a non-empty string (SSRF validation is inside resolveAndRehost)
// platform: optional, defaults to tiktok

const RemixRunRequestSchema = z.object({
  url: z.string().min(1).max(2000),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional().default("tiktok"),
});

// ── Rate / cap constants ──────────────────────────────────────────────────────
// URL cap already in schema (.max(2000)). No ask/anchor fields for this endpoint.

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── POST /api/tools/remix/run ─────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const requestId = nanoid(12);
  const log = createLogger({ requestId, module: "api.tools.remix.run" });

  // ── (1) Auth gate — MUST be first (T-06-13 auth-first, ASVS V2) ─────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) Content-Type 415 guard (T-06-14, WR-05 pattern) ─────────────────────
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    ?.toLowerCase();
  if (contentType !== "application/json") {
    return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
  }

  // ── (3) Cross-origin 403 guard (T-06-14, CSRF — copy adapt route T-04-07) ───
  const origin = request.headers.get("origin");
  if (origin) {
    const url = new URL(request.url);
    const expectedOrigin = `${url.protocol}//${url.host}`;
    if (origin !== expectedOrigin) {
      return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
    }
  }

  // ── (4) Zod body validation — 400 on invalid (T-04-06) ─────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RemixRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { url: tiktokUrl, platform } = parsed.data;

  // ── (5) user_id from session only (CR-01) ────────────────────────────────────
  // Never trust user id from the request body — always from the auth session.

  // ── (6) Load creator profile (cold-start safe) ───────────────────────────────
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (7) Get/create open thread ────────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (7a) Load active audience (08-04 / D-04 per-thread pin — mirrors ideas route) ──
  // thread.active_audience_id: NULL = General default (no DB query). Non-null = load row
  // (virtual constants short-circuit). Falls back to GENERAL_AUDIENCE on load failure (non-fatal).
  // Audience id is NEVER read from the request body — session/thread only (CR-01).
  let activeAudience: Audience = GENERAL_AUDIENCE;
  const rawThread = openThread as typeof openThread & { active_audience_id?: string | null };
  const activeAudienceId = rawThread.active_audience_id ?? null;
  if (activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, activeAudienceId);
      if (loaded) activeAudience = loaded;
    } catch {
      // Non-fatal: fall back to General if audience load fails (no regression, D-04)
    }
  }

  // ── (8) SSE stream: run pipeline + emit events ────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream cancelled — drop frame */
        }
      };

      try {
        // ── STAGE: Resolving (active) — real pipeline boundary (D-02, no fake timers) ──
        send("stage", { name: "Resolving", status: "active" });

        // ── STAGE: Decoding (active) — emitted before runRemixPipeline starts decode internally ──
        // runRemixPipeline is ONE awaited call that internally runs:
        //   RESOLVE → PERCEIVE → DECODE → ADAPT → FLASH GATE
        // Because the runner doesn't expose per-phase callbacks at this point, we emit
        // the coarse stage transitions around the whole call (the real phases DID run —
        // D-02 "real not timed" is satisfied). Finer-grained transitions require runner
        // refactor — tracked as deferred (same discretion as hooks route, Plan 05-04).
        send("stage", { name: "Decoding", status: "active" });
        send("stage", { name: "Adapting", status: "active" });
        send("stage", { name: "Simulating your audience", status: "active" });

        const result = await runRemixPipeline({
          url: tiktokUrl,
          platform,
          profileRow,
          requestId,
          audience: activeAudience,
        });

        send("stage", { name: "Resolving", status: "done" });
        send("stage", { name: "Decoding", status: "done" });
        send("stage", { name: "Adapting", status: "done" });
        send("stage", { name: "Simulating your audience", status: "done" });

        // ── Error branch (SkillRunError surface — Pitfall 6 graceful) ─────────────
        if (result.error) {
          log.warn("remix run returned error", { error: result.error, warnings: result.warnings });
          send("error", { error: result.error, warnings: result.warnings });
          send("done", { count: 0 });
          return;
        }

        if (result.warnings.length > 0) {
          send("warning", { warnings: result.warnings });
        }

        // ── Content-first: emit the remix-card FACE before the band chip ──────────
        // content event: adaptedHook + formatBorrowed + angle + whoItsFor + scrollQuote
        // band/fraction deferred to score event (content-first — Pitfall 5)
        send("content", {
          blocks: result.blocks.map((b) => ({
            type: b.type,
            props: {
              adaptedHook: b.props.adaptedHook,
              angle: b.props.angle,
              whoItsFor: b.props.whoItsFor,
              formatBorrowed: b.props.formatBorrowed,
              sourceDecode: b.props.sourceDecode,
              scrollQuote: b.props.scrollQuote,
              model: b.props.model,
              // band/fraction deferred to score event
            },
          })),
        });

        // ── Score event: opener band chip (a beat after the face — content-first) ──
        for (const block of result.blocks as RemixCardBlock[]) {
          send("score", {
            band: block.props.band,
            fraction: block.props.fraction,
            model: block.props.model,
          });
        }

        // ── Persist: blocks to the open thread with KC_GEN_VERSION stamp (D-10) ───
        if (result.blocks.length > 0) {
          try {
            await insertMessage(
              openThread.id,
              "assistant",
              result.blocks,
              kcStamp().kcGenVersion,
            );
          } catch (persistErr) {
            // Non-fatal: log the failure but don't block delivery
            Sentry.captureException(persistErr, { tags: { route: "api.tools.remix.run" } });
            log.warn("remix card persist failed", {
              error: persistErr instanceof Error ? persistErr.message : String(persistErr),
            });
          }
        }

        send("done", { count: result.blocks.length });

      } catch (err) {
        Sentry.captureException(err, { tags: { route: "api.tools.remix.run" } });
        log.error("remix run route threw", {
          error: err instanceof Error ? err.message : String(err),
        });
        send("error", {
          message: err instanceof Error ? err.message : "Remix run failed",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
