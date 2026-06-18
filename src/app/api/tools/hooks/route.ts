/**
 * /api/tools/hooks — Hooks generation SSE route (Plan 04-02, Task 2).
 *
 * POST — authenticate, over-generate ~8 hooks, parallel niche-SIM gate, RANK survivors,
 *         stream content-first (ranked card faces WITH lead scroll-quote + audience-archetype
 *         tag + rank → per-card band chip), persist to user's open thread stamped with
 *         KC_GEN_VERSION.
 *
 * GATE THEN RANK (D-01): over-generate → gate (band !== "Weak") → rank (band tier → fraction)
 * → top 5. QUALITATIVE only — no fabricated numeric pull-score, no view-count promise (ENGINE-03).
 *
 * Security mitigations (T-04-03 – T-04-09):
 *   - Auth enforced before any DB read (T-04-03)
 *   - Session user_id only — never from body (T-04-04 / CR-01)
 *   - Server-side ask + anchor length cap (T-04-06 / WARNING-5)
 *   - assembleBundle injection fence wraps ask + anchor (T-04-05, inside runner's assembler call)
 *   - runHooksPipeline gated by band !== "Weak" (HOOKS-02 / T-04-06)
 *   - insertMessage re-validates all blocks at write boundary (T-04-07)
 *   - KC_GEN_VERSION stamp on every persisted message (D-10)
 *   - Qwen-only: getQwenClient / QWEN_REASONING_MODEL (T-04-08)
 *   - Rate-limit deferred to v2 (same posture as Ideas — auth + ask-cap are v1 boundary)
 *
 * STREAMING PATTERN (IDEAS-02 pattern replicated):
 *   event: status  — "Generating hooks…" / "Scoring on your audience…"
 *   event: content — ranked card faces WITH lead scroll-quote + audienceArchetype + rank
 *   event: score   — per-card band chip (a beat later — content-first)
 *   event: done    — signal completion
 *
 * OPEN THREAD:
 *   Uses createOpenThreadLazy(userId): type:"open", reading_id:null.
 *   Hooks chain appends to the same open thread as Ideas.
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import type { HookCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ── Rate limit / cap constants ────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_SECS = 60;
const RATE_LIMIT_MAX_MSGS = 5;
const MAX_MESSAGE_LENGTH = 2000; // chars — WARNING-5: enforced server-side, independent of client
const MAX_ANCHOR_LENGTH = 5000;  // anchor is a full idea concept — allow more than a chat turn

// ── SSE headers ───────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── POST /api/tools/hooks ──────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-04-03) ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { ask?: unknown; platform?: unknown; anchor?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body is fine — ask defaults to empty
  }

  const rawAsk = typeof body.ask === "string" ? body.ask : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";
  const rawAnchor = typeof body.anchor === "string" ? body.anchor : undefined;

  // SERVER-SIDE ASK CAP (WARNING-5): independent of client validation (T-04-06)
  if (rawAsk.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `ask must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  // SERVER-SIDE ANCHOR CAP (WARNING-5): independent of client
  if (rawAnchor !== undefined && rawAnchor.length > MAX_ANCHOR_LENGTH) {
    return Response.json(
      { error: `anchor must be at most ${MAX_ANCHOR_LENGTH} characters` },
      { status: 400 },
    );
  }

  // Normalise platform to allowed enum values
  const platform = (
    ["tiktok", "instagram", "youtube"].includes(rawPlatform) ? rawPlatform : "tiktok"
  ) as "tiktok" | "instagram" | "youtube";

  // ── (3) Rolling rate limit (deferred to v2 — same posture as Ideas) ──────
  void RATE_LIMIT_WINDOW_SECS;
  void RATE_LIMIT_MAX_MSGS;

  // ── (4) Load creator profile (cold-start safe — D-09) ─────────────────────
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (5) Get/create open thread ────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (6) SSE stream: run pipeline + emit events ────────────────────────────
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
        // Status event: generation starting
        send("status", { message: "Generating hooks…" });

        const { blocks, warnings } = await runHooksPipeline({
          ask: rawAsk,
          platform,
          profileRow: profileRow ?? null,
          anchor: rawAnchor,
        });

        if (warnings.length > 0) {
          send("warning", { warnings });
        }

        // Status event: SIM has run
        send("status", { message: "Scoring on your audience…" });

        // Content event: ranked card faces WITH lead scrollQuote + audienceArchetype + rank
        // band/fraction deferred to score events below (content-first, IDEAS-02 pattern)
        send("content", {
          blocks: blocks.map((b) => ({
            type: b.type,
            props: {
              hookLine: b.props.hookLine,
              audienceArchetype: b.props.audienceArchetype, // D-03 audience tag
              mechanism: b.props.mechanism,
              seedHook: b.props.seedHook,
              rank: b.props.rank,                           // D-01 rank position
              scrollQuote: b.props.scrollQuote,             // D-02/D-04: on the face
              model: b.props.model,
              channel: b.props.channel,
              // band/fraction deferred to score events
            },
          })),
        });

        // Per-card score events: band chip (a beat after the face — content-first)
        for (const block of blocks as HookCardBlock[]) {
          send("score", {
            seedHook: block.props.seedHook,
            rank: block.props.rank,
            band: block.props.band,
            fraction: block.props.fraction,
            model: block.props.model,
          });
        }

        // Persist: blocks array (canonical body) + KC_GEN_VERSION provenance stamp (D-10)
        if (blocks.length > 0) {
          await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);
        }

        send("done", { count: blocks.length });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Hooks generation failed",
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
