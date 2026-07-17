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
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { requireSocialsAudience } from "@/lib/audience/require-socials-audience";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { classifyDiscoverInput, UNSUPPORTED_INPUT_REASON } from "@/lib/discover/classify-input";
import { type RankedOutlier } from "@/lib/discover/outlier-compute";
import { rankWithAudienceFit } from "@/lib/discover/explore-rank";
import {
  getCachedDiscover,
  setCachedDiscover,
  checkUserCap,
  recordUserPull,
} from "@/lib/discover/discover-cache";
import { runExplorePipeline } from "@/lib/tools/runners/explore-runner";
import { listTrackedAccounts } from "@/lib/tracked-accounts/tracked-accounts-repo";
import { OutlierGridBlockSchema, type OutlierGridBlock } from "@/lib/tools/blocks";
import type { Audience } from "@/lib/audience/audience-types";

// ── Server-side caps (independent of client) ────────────────────────────────────
const MAX_INPUT_LENGTH = 200; // a handle or short niche phrase (mirrors /api/discover)

// CR-01 — the un-niched / general trending pull. When the user fires Explore with NO
// niche/accounts/input (the default General-audience flagship quick-action, or a bare
// field-send), the route does NOT 400 — it runs a real scrape with a broad trending
// query (the composer documents this intent at composer.tsx:659 "empty → un-niched
// pull"). This is an HONEST default seed: a real scrape with a general term, NOT
// fabricated data. A General audience naturally yields fit=null (the honesty spine omits
// the fit bar — unchanged). Niche mode → source tag = this label (always non-empty, so
// OutlierGridBlockSchema's source.min(1) can never throw on this path — WR-03 guard).
const TRENDING_FALLBACK_QUERY = "trending";

// CR-02 — the "What competitors shipped" pull resolves the SESSION user's tracked
// accounts server-side (user_id is session-derived, NEVER from the body — CR-01 invariant)
// and pulls from up to this many handles, merged + ranked into one grid.
const MAX_TRACKED_PULL = 5;

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
  isMerged: boolean = false,
): OutlierGridBlock {
  const fitRanked = rankWithAudienceFit(ranked, audience, serendipity);
  // CR-02: merged competitors tiles are not individually trackable (no per-tile author);
  // mirrors runExplorePipeline so a cache-hit rebuild matches a cache-miss build.
  const trackable = mode === "profile" && !isMerged;
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

  // ── Layer 2 mock short-circuit (dev only) — replay fixtures, no engine call ──
  const mock = await maybeMockSkillRun("explore", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "explore");
  if (limited) return limited;

  // ── (2) Parse + validate body (EXPLORE-01 customizable params + serendipity) ──
  let body: {
    niche?: unknown;
    accounts?: unknown;
    timeWindow?: unknown;
    serendipity?: unknown;
    input?: unknown; // quick-action presets may pass a single input string
    tracked?: unknown; // CR-02 — card 2 sets this so the route pulls from tracked accounts
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

  // CR-02 — explicit "use my tracked accounts" signal (card 2). The handles are NEVER
  // sent by the client; the route resolves them from the SESSION user (CR-01 invariant).
  const wantTracked = body.tracked === true;

  // Determine the pull: prefer an explicit input (accounts → profile, else niche, else the
  // single `input` preset). Falls through to the tracked-accounts pull (CR-02) or the
  // un-niched trending pull (CR-01) when no explicit input is given.
  const pullInput = rawAccounts || rawNiche || rawInput;

  let mode: "profile" | "niche";
  let normalized: string;
  // CR-02 — when set, the runner scrapes EACH handle and merges before one rank pass.
  let mergeInputs: string[] | undefined;

  if (pullInput) {
    // Explicit input → classify (profile / niche / unsupported) via the reused classifier.
    const classified = classifyDiscoverInput(pullInput);
    if (classified.mode === "unsupported") {
      // Honest reject BEFORE the cap/scrape (nothing charged) — scraping is TikTok-only, so a
      // pasted non-TikTok link never silently degrades into a garbage niche pull.
      return Response.json(
        { error: "unsupported_input", message: classified.reason ?? UNSUPPORTED_INPUT_REASON },
        { status: 400 },
      );
    }
    mode = classified.mode;
    normalized = classified.normalized;
  } else if (wantTracked) {
    // CR-02 — competitors pull: resolve the session user's tracked accounts (RLS-scoped),
    // cap the list, and build a merged profile pull. user_id is session-derived (CR-01).
    const tracked = await listTrackedAccounts(supabase);
    const handles = tracked
      .map((a) => a.handle.replace(/^@/, "").trim().toLowerCase())
      .filter((h) => h.length > 0)
      .slice(0, MAX_TRACKED_PULL);

    if (handles.length === 0) {
      // Card 2 is UI-gated on hasTrackedAccounts, so this is a defensive race guard:
      // a clean 400 (SkillRunError-compatible), NOT a thrown 500/SSE error.
      return Response.json(
        { error: "no_tracked_accounts", message: "Track an account first to see what your competitors shipped." },
        { status: 400 },
      );
    }

    mode = "profile";
    normalized = handles[0]!; // primary source (tag + single-handle track attribution)
    mergeInputs = handles;
  } else {
    // CR-01 — no input at all → honest un-niched trending pull (a real scrape with a broad
    // query). source tag is the non-empty fallback label, so the block schema can't throw.
    mode = "niche";
    normalized = TRENDING_FALLBACK_QUERY;
  }

  // A merged competitors pull mixes several handles into one ranked set; its tiles are NOT
  // individually trackable (no per-tile author — RESEARCH Q3) and its cache entry must NOT
  // collide with a single-handle profile pull of the same first handle. Both the runner
  // (trackability) and the cache key (below) need this flag.
  const isMerged = (mergeInputs?.length ?? 0) > 1;

  // Cache key: the measured ranking is keyed per (key, mode, day). For a merged pull the
  // composite includes every handle so a 3-account competitors pull never reuses a
  // single-account pull's cache (Pitfall 6 — distinct inputs → distinct keys).
  const cacheKey = isMerged ? `competitors:${mergeInputs!.join(",")}` : normalized;

  // ── (3) Open thread + active audience (CR-01 — id NEVER from body) ─────────
  const openThread = await createOpenThreadLazy(user.id);
  const activeAudience = await resolveThreadAudience(supabase, openThread, user.id);

  // ── MODE-01 — the socials-skill guard (server half of the mode seam) ─────────
  // explore is socials-shaped by construction. A `mode: 'general'` audience (a panel, a
  // named person) is not a crowd on a feed — refuse it rather than write feed content for it.
  // The composer already hides this skill for a general audience; this catches a stale
  // client, a restored thread, and any direct API call.
  {
    const refusal = requireSocialsAudience(activeAudience, "explore");
    if (refusal) return refusal;
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
        // Cache check (per key, mode, day — Pitfall 5/6). Stores measured ranked tiles.
        // cacheKey == normalized for normal pulls; a composite for a merged competitors pull.
        const cachedRanked = getCachedDiscover<RankedOutlier>(cacheKey, mode);

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
            isMerged,
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
            mergeInputs,
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
          setCachedDiscover<RankedOutlier>(cacheKey, mode, result.ranked);
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
