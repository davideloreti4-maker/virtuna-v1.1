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
import { createServiceClient } from "@/lib/supabase/service";
import { insertBlueprint } from "@/lib/remix/blueprint-repo";
import { CLIPS_BUCKET } from "@/lib/remix/clip-storage";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runRemixPipeline } from "@/lib/tools/runners/remix-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { createLogger } from "@/lib/logger";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { requireSocialsAudience } from "@/lib/audience/require-socials-audience";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
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
  // Per-run reaction lens (GAP-C2 / §P.10) — composer override; absent → audience default.
  intent: z.enum(["grow", "sell"]).optional(),
  // The creator's brief (D3): what THEY want to make from this source. When present it is the
  // adaptation target and the niche is only a fallback. Absent → today's behaviour, unchanged.
  // Capped at 200 chars — it reaches the adapt prompt as text, so it is bounded like every other
  // free-text field on a mutating route.
  brief: z.string().max(200).optional(),
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

  // ── Layer 2 mock short-circuit (dev only) — replay fixtures, no engine call ──
  const mock = await maybeMockSkillRun("remix", user.id);
  if (mock) return mock;

  // ── (2-3) CSRF guard — Content-Type 415 + cross-origin 403 (T-06-14, WR-01) ──
  // Shared helper (src/lib/http/csrf-guard.ts) — the SSOT for this guard pair across
  // all mutating POST routes. Was inlined here; factored out per WR-01.
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user, "remix");
  if (refusal) return refusal;

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

  const { url: tiktokUrl, platform, intent: bodyIntent, brief } = parsed.data;

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

  // ── MODE-01 — the socials-skill guard (server half of the mode seam) ─────────
  // Remix decodes a TikTok winner into the creator's version — socials-shaped by construction.
  // A `mode: 'general'` audience (a panel, a named person) is not a crowd on a feed; refuse it
  // rather than remix a TikTok hook "for" an analyst panel. The composer already hides Remix for
  // a general audience — this catches a stale client, a restored thread, and direct API calls.
  {
    const refusal = requireSocialsAudience(activeAudience, "remix");
    if (refusal) return refusal;
  }

  // ── (7b) Resolve per-run intent (GAP-C2 / §P.10) ──────────────────────────────
  // Explicit composer override (Zod-validated above) wins; else default from goal_intent (4→2).
  // The runner gates this to undefined for General/no-audience (no-op, regression gate).
  const effectiveIntent = bodyIntent ?? goalIntentToLens(activeAudience.goal_intent);

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
        // Stage events now stream from the REAL pipeline boundaries (Resolving → Decoding →
        // Adapting → Simulating your audience) via onStage — the spine reflects genuine phase
        // timing instead of all four flashing active at once + a burst of dones at the end
        // (D-02: real boundaries, no fake timers).
        const result = await runRemixPipeline({
          url: tiktokUrl,
          platform,
          profileRow,
          requestId,
          audience: activeAudience,
          intent: effectiveIntent,
          brief: brief ?? null,
          onStage: (name, status) => send("stage", { name, status }),
          // EVIDENCE frame — the real artifacts this run touched (the proven outliers it is
          // grounded on / the post it resolved), streamed while the pipeline is still working so
          // the loading spine shows the WORK, not just the step name. Additive: a client that
          // does not parse `evidence` is unaffected.
          onEvidence: (evidence) => send("evidence", evidence),
          // FLYWHEEL-02: pin the predicted vector for this run (text skill → no analysis).
          pin: { supabase, analysisId: null },
        });

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

        // ── Persist the shoot sheet BEFORE anything announces it ──────────────────
        // The row has to exist before the id leaves this process, and the id leaves on the
        // CONTENT frame — not on the persisted message. The brief placed this next to
        // insertMessage, which is early enough for a reload and too late for the live card: the
        // face would already be on the wire carrying an id whose row failed to write, and the
        // creator would watch a sheet that can never resolve.
        //
        // Non-fatal, deliberately: a run that produced three cards must not die because one
        // side-table write failed. We drop the id and ship the cards — the sheet is absent
        // rather than broken. `insertBlueprint` throws on ANY write error (Task 4), which is
        // exactly what this catch is here to absorb; so does `createServiceClient()` when the
        // service key is missing.
        if (result.blueprint) {
          try {
            await insertBlueprint(createServiceClient(), {
              id: result.blueprint.id,
              user_id: user.id,
              thread_id: openThread.id,
              source_video_id: result.blueprint.sourceVideoId,
              blueprint: result.blueprint.payload,
              script: result.blueprint.script,
              clip_uris: result.blueprint.clipPaths,
            });
          } catch (bpErr) {
            Sentry.captureException(bpErr, { tags: { route: "api.tools.remix.run" } });
            log.warn("blueprint persist failed — cards will render without beats", {
              error: bpErr instanceof Error ? bpErr.message : String(bpErr),
            });
            for (const b of result.blocks) {
              delete (b.props as { blueprintId?: string }).blueprintId;
              delete (b.props as { blueprintVariant?: number }).blueprintVariant;
            }
            // Phase 4: clips were uploaded on the promise this row would list them. No row ⇒
            // outside the reaper's worklist forever (§5 sweeps rows, not the bucket) — remove
            // them now, best-effort. A failure here is the accepted residual window (spec §10).
            if (result.blueprint.clipPaths.length > 0) {
              try {
                // Storage's `remove()` does NOT throw for API-level failures (permission / RLS /
                // missing bucket) — it resolves `{ data, error }` like every other supabase-js
                // call. The try/catch here is for genuine throws only (e.g. `createServiceClient`
                // itself throwing when the service key is missing); the resolved error has to be
                // read explicitly or a failed delete reports success.
                const { error: rmError } = await createServiceClient()
                  .storage.from(CLIPS_BUCKET)
                  .remove(result.blueprint.clipPaths);
                if (rmError) {
                  log.warn("orphaned clip cleanup failed", { error: rmError.message });
                }
              } catch (rmErr) {
                log.warn("orphaned clip cleanup failed", {
                  error: rmErr instanceof Error ? rmErr.message : String(rmErr),
                });
              }
            }
          }
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
              // SHOOT SHEET (phase 1, 2026-08-10): the beat script's address. `proof`,
              // `production` and `provenance` were each shipped persisted-but-absent from this
              // exact map, and each produced a card that only became correct after a reload.
              // Both fields ride the face — the variant too, or every card in the run renders
              // the rank-1 card's sheet.
              blueprintId: b.props.blueprintId,
              blueprintVariant: b.props.blueprintVariant,
              production: b.props.production,    // owner 2026-07-22: YOUR-version shoot plan rides the FACE (else reload-only)
              sourceDecode: b.props.sourceDecode,
              scrollQuote: b.props.scrollQuote,
              model: b.props.model,
              provenance: b.props.provenance,    // new call system: "projected" must ride the FACE — else the live card
                                                 // reads "measured" and only self-corrects to "would stop / projected" after a reload.
              // SOURCE ATTRIBUTION (2026-07-13): remix adapts ONE specific real video — the receipt
              // (handle/views/cover) IS the card's core content. It was persisted but dropped from
              // this face, so the source rendered as an anonymous thumbnail until a reload. Same
              // reload-only hazard as proof on hooks/ideas — must ride the face, not just persist.
              proof: b.props.proof,             // attributed source video receipt
              coverUrl: b.props.coverUrl,       // back-compat source thumbnail (superseded by proof for display)
              audienceName: b.props.audienceName, // D-03 steer tag — the calibrated audience this remix was generated for
              personas: b.props.personas,       // S3′: real per-persona reactions → named ambient Room cast (Task B)
              population: b.props.population,    // Audience Sim v2 Stage 2: the N-individual projection → Population·1,000 Sheet (rides the face)
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

                // BILL — on delivery only: the cards are persisted above; a run that died
        // never reaches this line, so it never charges.
        if (result.blocks.length > 0) {
          await billUsage({ userId: user.id, action: "remix", tier: creditVerdict.tier });
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
