/**
 * /api/tools/explore — Explore (audience-curated discovery) SSE route (Plan 11-04, Task 2).
 *
 * POST — authenticate, parse + cap the customizable Explore params (niche / accounts /
 *         time-window / serendipity valve), load the ACTIVE calibrated audience from the
 *         open thread (NEVER the body — CR-01), enforce the per-user daily cap, pull
 *         outliers (apidojo, the reused Discover stack), audience-fit re-rank them
 *         (rankWithAudienceFit — pure math), stream the extended outlier-grid block
 *         content-first, and persist it to the open thread stamped with KC_GEN_VERSION.
 *
 * This mirrors the canonical skill-chain SSE route (hooks/route.ts), but the body work
 * delegates to runExplorePipeline — Explore has NO Flash/gate loop, so a thin runner is
 * the whole pipeline.
 *
 * HARD CONSTRAINTS:
 *   - NO SIM/Flash call anywhere in this route (D-02/D-03, RESEARCH Pitfall 6). The grid
 *     is pure re-ranked math; the real reaction is lazy (on tap, via the UNCHANGED
 *     remix-card). ENGINE_VERSION stays "3.19.0".
 *   - NO fake progress % (UI-SPEC honesty — the apidojo pull is genuinely minutes).
 *   - This route is an SSE PRODUCER only — it never navigates or arms any nav.
 *   - Audience id is ALWAYS read from openThread.active_audience_id, never the body (CR-01).
 *
 * SSE EVENT CONTRACT (clients parse `event:`/`data:` lines):
 *   event: stage   — { name: "Pulling outliers" | "Scoring for your audience", status }
 *   event: content — { blocks: [outlier-grid block] }  (content-first)
 *   event: done    — { count }
 *   event: error   — { message }
 *
 * SECURITY (mirrors /api/tools/hooks + /api/discover):
 *   - Auth enforced BEFORE any scrape / cache work (user_id from session only — CR-01).
 *   - CSRF guard (Content-Type 415 + cross-origin 403).
 *   - Server-side param length caps, independent of the client.
 *   - insertMessage re-validates blocks at the write boundary (D-14).
 *   - KC_GEN_VERSION stamp on every persisted message (D-10).
 *
 * CACHE / CAP (RESEARCH Pitfall 5 — reused AS-IS, in-memory):
 *   The Discover cache + daily cap are module-level in-memory state (single-instance —
 *   not durable across serverless cold starts). Reused here as an accepted v1 trade: the
 *   cap is a soft Apify-spend guard, NOT a billing control (real rate-limiting is the
 *   HARDEN-01 pre-launch gate). The cache stores the ranked (measured) tiles; the
 *   audience-fit re-rank is recomputed PER REQUEST (fit depends on the active audience,
 *   not just the pull), so a cache hit re-fits before building the block.
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import { type RankedOutlier } from "@/lib/discover/outlier-compute";
import { rankWithAudienceFit } from "@/lib/discover/explore-rank";
import {
  getCachedDiscover,
  setCachedDiscover,
  checkUserCap,
  recordUserPull,
} from "@/lib/discover/discover-cache";
import { runExplorePipeline } from "@/lib/tools/runners/explore-runner";
import { OutlierGridBlockSchema, type OutlierGridBlock } from "@/lib/tools/blocks";
import type { Audience } from "@/lib/audience/audience-types";

// ── Server-side caps (independent of client) ────────────────────────────────────
const MAX_INPUT_LENGTH = 200; // a handle or short niche phrase (mirrors /api/discover)

// ── SSE headers ─────────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

/**
 * D-15 source tag — mirrors Discover / explore-runner:
 *   niche pulls tag the niche query; profile pulls tag "Competitor".
 */
function sourceTag(mode: "profile" | "niche", normalized: string): string {
  return mode === "niche" ? normalized : "Competitor";
}

/**
 * Build a validated outlier-grid block from cached (measured) ranked tiles, re-running
 * the audience-fit re-rank for the active audience (fit depends on the audience, not the
 * pull — so a cache hit must re-fit). Mirrors runExplorePipeline's build+validate step.
 */
function buildBlockFromRanked(
  ranked: RankedOutlier[],
  audience: Audience,
  mode: "profile" | "niche",
  normalized: string,
  serendipity: number,
): OutlierGridBlock {
  const fitRanked = rankWithAudienceFit(ranked, audience, serendipity);
  const trackable = mode === "profile";
  const trackHandle = trackable ? normalized.replace(/^@/, "").toLowerCase() : undefined;
  const source = sourceTag(mode, normalized);

  const block = {
    type: "outlier-grid" as const,
    props: {
      mode,
      tiles: fitRanked.map((t) => ({
        platformVideoId: t.platformVideoId,
        videoUrl: t.videoUrl,
        caption: t.caption,
        views: t.views,
        likes: t.likes,
        comments: t.comments,
        shares: t.shares,
        saves: t.saves,
        durationSeconds: t.durationSeconds,
        postedAt: t.postedAt.toISOString(),
        multiplier: t.multiplier,
        baselineLabel: t.baselineLabel,
        source,
        fit: t.fit,
        trackable,
        trackHandle: trackable ? trackHandle : undefined,
      })),
    },
  };

  const parsed = OutlierGridBlockSchema.safeParse(block);
  if (!parsed.success) {
    throw new Error(`explore block validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

// ── POST /api/tools/explore ──────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate — before any scrape/cache work (CR-01) ──────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (2) Parse + validate body (EXPLORE-01 customizable params + serendipity) ──
  let body: {
    niche?: unknown;
    accounts?: unknown;
    timeWindow?: unknown;
    serendipity?: unknown;
    input?: unknown; // quick-action presets may pass a single input string
  } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawNiche = typeof body.niche === "string" ? body.niche.trim() : "";
  const rawAccounts = typeof body.accounts === "string" ? body.accounts.trim() : "";
  const rawInput = typeof body.input === "string" ? body.input.trim() : "";

  // Server-side length caps (independent of client — mirror hooks/discover).
  for (const [label, value] of [
    ["niche", rawNiche],
    ["accounts", rawAccounts],
    ["input", rawInput],
  ] as const) {
    if (value.length > MAX_INPUT_LENGTH) {
      return Response.json(
        { error: `${label} must be at most ${MAX_INPUT_LENGTH} characters` },
        { status: 400 },
      );
    }
  }

  // Serendipity valve (D-06): coerce to a number clamped 0..1 (default 0 = on-niche).
  const rawSerendipity = typeof body.serendipity === "number" ? body.serendipity : 0;
  const serendipity = Math.min(1, Math.max(0, Number.isFinite(rawSerendipity) ? rawSerendipity : 0));

  // timeWindow is accepted (EXPLORE-01 param) but not yet threaded into the pull — the
  // outlier ranker already applies a recency window (WINDOW_DAYS=90) + half-life decay.
  // Narrowing by today/week/month is a refinement tracked for a follow-up (kept honest:
  // we don't pretend to filter by it). Read it so the param is part of the contract.
  void body.timeWindow;

  // Determine the pull input: prefer accounts (a handle → profile pull), else niche, else
  // the single `input` preset string. Both empty → 400.
  const pullInput = rawAccounts || rawNiche || rawInput;
  if (!pullInput) {
    return Response.json({ error: "input is required" }, { status: 400 });
  }

  // Classify (profile vs niche) — reused Discover classifier.
  const { mode, normalized } = classifyDiscoverInput(pullInput);

  // ── (3) Open thread + active audience (CR-01 — id NEVER from body) ─────────
  const openThread = await createOpenThreadLazy(user.id);
  let activeAudience: Audience = GENERAL_AUDIENCE;
  const activeAudienceId = openThread.active_audience_id ?? null;
  if (activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, activeAudienceId);
      if (loaded) activeAudience = loaded;
    } catch {
      // Non-fatal: fall back to General if the audience load fails (no regression).
    }
  }

  // ── (4) Per-user daily cap (read-only check; consume only on a real scrape) ──
  const cap = checkUserCap(user.id);
  if (!cap.allowed) {
    // Friendly cap signal — NOT a 500 (SkillRunError-compatible shape).
    return Response.json(
      {
        error: "daily_cap_reached",
        message: `You've hit today's Explore limit (${cap.limit} pulls). Try again tomorrow.`,
        used: cap.used,
        limit: cap.limit,
      },
      { status: 429 },
    );
  }

  // ── (5) SSE stream: pull → fit → build → stream → persist ──────────────────
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
        // Cache check (per input, mode, day — Pitfall 5/6). Stores measured ranked tiles.
        const cachedRanked = getCachedDiscover<RankedOutlier>(normalized, mode);

        let block: OutlierGridBlock;

        if (cachedRanked) {
          // Cache HIT: skip the scrape, but re-run the audience-fit re-rank (fit depends
          // on the active audience, not just the pull) before building the block.
          send("stage", { name: "Pulling outliers", status: "done" });
          send("stage", { name: "Scoring for your audience", status: "active" });
          // postedAt is a Date on RankedOutlier but JSON-serialized in the cache; rehydrate.
          const rehydrated = cachedRanked.map((t) => ({
            ...t,
            postedAt: t.postedAt instanceof Date ? t.postedAt : new Date(t.postedAt),
          }));
          block = buildBlockFromRanked(
            rehydrated,
            activeAudience,
            mode,
            normalized,
            serendipity,
          );
          send("stage", { name: "Scoring for your audience", status: "done" });
        } else {
          // Cache MISS: real pull + rank + fit + build via the runner (no SIM call).
          send("stage", { name: "Pulling outliers", status: "active" });
          const result = await runExplorePipeline({
            audience: activeAudience,
            mode,
            normalizedInput: normalized,
            serendipity,
          });
          block = result.block;
          send("stage", { name: "Pulling outliers", status: "done" });
          send("stage", { name: "Scoring for your audience", status: "active" });
          send("stage", { name: "Scoring for your audience", status: "done" });

          // Consume a pull + cache the MEASURED ranked tiles from THIS pull (no second
          // scrape — the runner returns them). The cache stores the audience-independent
          // measured ranking so subsequent same-day pulls skip the scrape and re-fit per
          // the active audience (Pitfall 5 — in-memory soft optimization).
          recordUserPull(user.id);
          setCachedDiscover<RankedOutlier>(normalized, mode, result.ranked);
        }

        // Content event: the outlier-grid block (content-first — no fake %).
        send("content", { blocks: [block] });

        // Persist: blocks array (canonical body) + KC_GEN_VERSION stamp (D-10).
        await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);

        send("done", { count: block.props.tiles.length });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Explore pull failed",
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
