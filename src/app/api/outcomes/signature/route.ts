/**
 * POST /api/outcomes/signature — SSE outcome-capture route (FLYWHEEL-01/03).
 *
 * The "measure → reconcile" arc of the flywheel (predict→post→measure→reconcile→correct):
 * paste a posted URL → scrape public metrics → build a provenance-tagged REALIZED
 * signature → reconcile it against the PINNED predicted vector (Pitfall 6, never recompute)
 * → write the realized side back + log a classified reconciliation row.
 *
 * Mirrors /api/audiences/calibrate (the SSE precedent): maxDuration=300, auth-first
 * getUser(), ReadableStream send(event,data), status→done/error events, generic error
 * copy that never echoes raw user input.
 *
 * SSE event names (UI-SPEC §"Outcome capture — signature"):
 *   event: status  — { message } — "Reading the post…"
 *   event: error   — { message }  — generic copy ("Couldn't read that post…"), never echoes the URL
 *   event: done    — { reconciliation_id, outcome_id, predicted, realized, metrics } —
 *                    captured + reconciled (+ the vectors/real numbers for the inline readout)
 *
 * Honesty spine (Pitfall 3): a BLANK private field is EXCLUDED entirely (null channel),
 * never zero-filled. Each public channel is tagged public_scrape; each supplied private
 * field is tagged creator_supplied.
 *
 * Security (STRIDE T-10-06 / T-10-07):
 *  - Auth-first getUser() before any DB read (CR-01).
 *  - Zod-validates the body; user_id derived from session inside the repos.
 *  - posted_url routed through the scrapeSinglePostMetrics SSRF guard (HTTPS + TikTok host).
 *  - Generic error copy; the raw URL is NEVER echoed into an error event.
 *  - maxDuration=300 for Apify latency (Pitfall 4).
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { IngestError } from "@/lib/scraping/types";
import {
  realizedSignature,
  type RealizedMetrics,
  type MetricChannel,
} from "@/lib/flywheel/realized-signature";
import { reconcile } from "@/lib/flywheel/reconcile";
import {
  findPinnedPrediction,
  updateOutcomeRealized,
  type RawMetrics,
  type DispositionVector,
} from "@/lib/flywheel/outcome-repo";
import { insertReconciliation } from "@/lib/flywheel/reconciliation-repo";
import type { GoalIntent } from "@/lib/audience/audience-types";

// Apify single-post scrape can take 1-3 minutes — allow max 300s.
export const maxDuration = 300;

// ─── Input validation ──────────────────────────────────────────────────────────

const PrivateSignalsSchema = z.object({
  saves: z.number().nonnegative().optional(),
  watch_through_pct: z.number().min(0).max(100).optional(),
  link_clicks: z.number().nonnegative().optional(),
});

const CaptureSchema = z.object({
  analysis_id: z.string().nullable().optional(),
  audience_id: z.string().uuid().nullable().optional(),
  posted_url: z.string().url(),
  private: PrivateSignalsSchema.optional(),
});

// ─── SSE helpers (mirror calibrate/route.ts) ─────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

/** Generic, input-free scrape-failure copy (UI-SPEC §"Scrape-fail error"). */
const SCRAPE_FAIL_COPY =
  "Couldn't read that post. Check the URL is public, or add your metrics by hand below.";

/** A present private number → a creator_supplied channel; a blank/undefined → null (excluded). */
function creatorSupplied(v: number | undefined): MetricChannel {
  return v == null ? null : { value: v, source: "creator_supplied" };
}

/** A present public number → a public_scrape channel; absent → null (excluded, never zero). */
function publicScrape(v: number | null | undefined): MetricChannel {
  return v == null ? null : { value: v, source: "public_scrape" };
}

// ─── POST /api/outcomes/signature ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (CR-01 / T-10-06) ──────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CaptureSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_capture_input" }, { status: 400 });
  }

  const { analysis_id, audience_id, posted_url, private: priv } = parsed.data;

  // ── (3) SSE stream ────────────────────────────────────────────────────────
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
        send("status", { message: "Reading the post…" });

        // ── Scrape public metrics through the SSRF guard (T-10-07) ──────────
        const provider = new ApifyScrapingProvider();
        let video;
        try {
          video = await provider.scrapeSinglePostMetrics(posted_url);
        } catch (err) {
          // SSRF reject / scrape failure / empty dataset — generic copy, never echo URL.
          if (err instanceof IngestError) {
            send("error", { message: SCRAPE_FAIL_COPY });
            return;
          }
          throw err;
        }

        // Deleted / private / 404 post → honest null (never zero-fill).
        if (!video) {
          send("error", { message: SCRAPE_FAIL_COPY });
          return;
        }

        // ── Build provenance-tagged RealizedMetrics (Pitfall 3) ─────────────
        // Public channels (from the post): views (denominator), shares, comments, saves.
        // Private channels (creator-supplied, optional): saves override, watch-through, link-clicks.
        // A blank private field stays null → EXCLUDED entirely (never counted as zero).
        const metrics: RealizedMetrics = {
          views: video.views ?? null,
          // saves: prefer the creator-supplied private value when given, else the public scrape.
          saves:
            creatorSupplied(priv?.saves) ?? publicScrape(video.saves),
          shares: publicScrape(video.shares),
          comments: publicScrape(video.comments),
          watch_through_pct: creatorSupplied(priv?.watch_through_pct),
          link_clicks: creatorSupplied(priv?.link_clicks),
        };

        const realized = realizedSignature(metrics);

        // ── Read the PINNED prediction (Pitfall 6 — compare only, never recompute) ──
        const pinned = await findPinnedPrediction(supabase, {
          analysisId: analysis_id ?? null,
          audienceId: audience_id ?? null,
        });

        if (!pinned) {
          // No pinned prediction to reconcile against — cannot honestly reconcile.
          send("error", {
            message:
              "No matching prediction found to reconcile against. Run a SIM on this content first.",
          });
          return;
        }

        // ── Reconcile realized vs PINNED predicted (calibration-vs-craft, A1) ──
        const reconciliation = reconcile(pinned.predicted_vector, realized.vector);

        // ── Persist: write realized side back + log the reconciliation row ──
        const rawMetrics: RawMetrics = {
          views: video.views ?? null,
          likes: video.likes ?? null,
          comments: video.comments ?? null,
          shares: video.shares ?? null,
          saves: priv?.saves ?? video.saves ?? null,
          watch_through_pct: priv?.watch_through_pct ?? null,
          link_clicks: priv?.link_clicks ?? null,
        };

        await updateOutcomeRealized(supabase, pinned.id, {
          realized_vector: realized.vector as DispositionVector,
          realized_provenance: realized.provenance,
          raw_metrics: rawMetrics,
          platform_post_url: posted_url,
          source: "paste_url",
        });

        // Best-effort enrichment: pull goal_intent from the audience for the cross-creator seed.
        let goalIntent: GoalIntent | null = null;
        if (pinned.audience_id) {
          try {
            const { data: aud } = await supabase
              .from("audiences")
              .select("goal_intent")
              .eq("id", pinned.audience_id)
              .single();
            goalIntent = (aud?.goal_intent ?? null) as GoalIntent | null;
          } catch {
            /* enrichment is non-fatal */
          }
        }

        const recRow = await insertReconciliation(supabase, {
          outcome_signature_id: pinned.id,
          audience_id: pinned.audience_id,
          goal_intent: goalIntent,
          predicted_vector: pinned.predicted_vector,
          realized_vector: realized.vector as DispositionVector,
          divergence_vector: reconciliation.divergenceVector,
          classification: reconciliation.classification,
          proposal_state: "logged",
        });

        // Emit the comparison so the client can show an honest inline "predicted vs actual"
        // readout (buildOutcomeReadout) + the real public numbers — no extra round-trip.
        send("done", {
          reconciliation_id: recRow.id,
          outcome_id: pinned.id,
          predicted: pinned.predicted_vector,
          realized: realized.vector,
          metrics: {
            views: rawMetrics.views,
            saves: rawMetrics.saves,
            shares: rawMetrics.shares,
            comments: rawMetrics.comments,
          },
        });
      } catch (err) {
        // Generic error — never echo the raw URL or DB internals.
        send("error", {
          message:
            err instanceof Error && err.message === "unauthenticated"
              ? "Your session expired. Sign in and try again."
              : SCRAPE_FAIL_COPY,
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
