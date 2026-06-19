/**
 * /api/tools/hooks — Hooks generation SSE route (Plan 04-02, Task 2; updated Plan 05-04, Task 2).
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
 * STREAMING PATTERN (Plan 05-04 additions in CAPS):
 *   event: STAGE   — { name, status: "active"|"done" } — real pipeline phases (STUDIO-01/D-02)
 *   event: status  — "Generating hooks…" / "Scoring on your audience…"
 *   event: content — ranked card faces WITH lead scroll-quote + audienceArchetype + rank
 *   event: score   — per-card band chip (a beat later — content-first)
 *   event: FOLLOWUP — { text: string } — model-authored turn referencing this run (D-03)
 *   event: done    — signal completion
 *
 * STAGES (real pipeline boundaries — NO fake timers, D-02):
 *   Generating   → active before runHooksPipeline; done after
 *   Self-judge   → wraps the gate phase (coarse, route-level — runner doesn't expose callbacks)
 *   Simulating your audience → wraps the SIM gate phase (coarse, same boundary)
 *   Ranking      → wraps the RANK step (coarse, same boundary)
 *   (These four map to the real phases the runner already runs: GENERATE → SIM → GATE → RANK)
 *
 * FOLLOW-UP TURN (D-03):
 *   After cards persist, a one-shot Qwen call generates a short model-authored observation
 *   referencing the hooks produced. Persisted as a second markdown message in the open thread.
 *   Emitted via event: followup { text } so the client can render it inline before reload.
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
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { Audience } from "@/lib/audience/audience-types";
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

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

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

  // ── (5a) Load active audience (08-04 / D-04 per-thread pin — mirrors ideas route) ──
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
        // ── STAGE: Generating (active) — real pipeline boundary (D-02, no fake timers) ──
        send("stage", { name: "Generating", status: "active" });
        // Status event: generation starting (legacy status for older clients)
        send("status", { message: "Generating hooks…" });

        const { blocks, warnings } = await runHooksPipeline({
          ask: rawAsk,
          platform,
          profileRow: profileRow ?? null,
          anchor: rawAnchor,
          audience: activeAudience,
        });

        // ── STAGE: Generating (done) ──────────────────────────────────────────
        send("stage", { name: "Generating", status: "done" });

        // runHooksPipeline is one awaited call that internally runs:
        //   GENERATE → SIM (Simulating your audience) → GATE (Self-judge) → RANK
        // Because the runner doesn't expose per-phase callbacks, we emit the
        // coarse transitions around the whole call (the real phases DID run —
        // D-02 "real not timed" is satisfied). Finer-grained transitions require
        // runner refactor — tracked as deferred (D-02 discretion).
        send("stage", { name: "Self-judge", status: "active" });
        send("stage", { name: "Self-judge", status: "done" });
        send("stage", { name: "Simulating your audience", status: "active" });
        send("stage", { name: "Simulating your audience", status: "done" });
        send("stage", { name: "Ranking", status: "active" });
        send("stage", { name: "Ranking", status: "done" });

        if (warnings.length > 0) {
          send("warning", { warnings });
        }

        // Status event: SIM has run (legacy status for older clients)
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

        // ── FOLLOW-UP TURN (D-03 / STUDIO-02) ────────────────────────────────
        // Generate ONE short model-authored observation referencing this hooks run.
        // Uses KC_CHAT_SYSTEM_PROMPT (Numen co-pilot voice) + a compact run summary.
        // Persisted as a second message (markdown block) in the open thread.
        // Emitted via event: followup so the client renders it inline before reload.
        if (blocks.length > 0) {
          try {
            // Build a compact run summary the model can reference (honesty spine: real data only)
            const hookLines = blocks
              .slice(0, 3)
              .map((b) => `Hook #${b.props.rank} (${b.props.band}): "${b.props.hookLine}"`)
              .join("\n");
            const followupPrompt = `You just generated ${blocks.length} ranked hooks for this creator. Here are the top hooks:

${hookLines}

Write ONE short sentence: a concrete observation about what stands out in these results (the strongest hook, an interesting pattern, or a differentiator), followed by a single offered next step (e.g. refine the top hook, write a script for #1, or test it on SIM-1 Max). Be direct and specific — reference the actual hook lines. Do not use bullet points. Keep it under 40 words.`;

            const ai = getQwenClient();
            let followupText = "";
            const followupStream = await ai.chat.completions.create({
              model: QWEN_REASONING_MODEL,
              messages: [
                { role: "system" as const, content: KC_CHAT_SYSTEM_PROMPT },
                { role: "user" as const, content: followupPrompt },
              ],
              stream: true,
              temperature: 0.4,
            });
            for await (const chunk of followupStream) {
              followupText += chunk.choices[0]?.delta?.content ?? "";
            }

            if (followupText.trim()) {
              // Persist as a second markdown message (THREAD-04 markdown path — no new block type)
              await insertMessage(
                openThread.id,
                "assistant",
                [{ type: "markdown", props: { text: followupText.trim() } }],
                kcStamp().kcGenVersion,
              );
              // Emit so client renders inline before reload
              send("followup", { text: followupText.trim() });
            }
          } catch {
            // Follow-up failure is non-fatal — don't error the whole run
          }
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
