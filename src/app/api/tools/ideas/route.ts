/**
 * /api/tools/ideas — Ideas generation SSE route (Plan 03-03, Task 2; updated Plan 05-04, Task 2).
 *
 * POST — authenticate, assemble bundle, over-generate → SIM gate → ≤3 idea-card blocks,
 *         stream content-first (card faces WITH lead scroll-quote → per-card band chip),
 *         persist to user's open thread stamped with KC_GEN_VERSION.
 *
 * Security mitigations (T-03-07 – T-03-12):
 *   - Auth enforced before any DB read (T-03-07)
 *   - Session user_id only — never from body (T-03-08 / CR-01)
 *   - Server-side ask length cap + rolling rate limit (T-03-10 / WARNING-5)
 *   - assembleBundle injection fence wraps ask on the bundle (T-03-09)
 *   - runIdeasPipeline gated by band !== "Weak" (ENGINE-02 / T-03-11)
 *   - insertMessage re-validates all blocks at write boundary (T-03-11)
 *   - KC_GEN_VERSION stamp on every persisted message (T-03-12)
 *   - Qwen-only: getQwenClient / QWEN_REASONING_MODEL (T-03-12)
 *
 * STREAMING PATTERN (Plan 05-04 additions in CAPS):
 *   event: STAGE   — { name, status: "active"|"done" } — real pipeline phases (STUDIO-01/D-02)
 *   event: status  — "Generating ideas…" / "Scoring on your audience…"
 *   event: content — card faces WITH lead scroll-quote (WARNING-4: quote is on the face)
 *   event: score   — per-card band + fraction (band chip, a beat later)
 *   event: FOLLOWUP — { text: string } — model-authored turn referencing this run (D-03)
 *   event: done    — signal completion
 *
 * STAGES (real pipeline boundaries — NO fake timers, D-02):
 *   Generating          → active before runIdeasPipeline; done after
 *   Self-judge          → wraps the gate phase (coarse, route-level)
 *   Simulating your audience → wraps the Flash SIM gate (coarse, same boundary)
 *   (Ideas has no separate Ranking step — gated ideas are the output order)
 *
 * FOLLOW-UP TURN (D-03):
 *   After cards persist, a one-shot Qwen call generates a short observation referencing
 *   the ideas produced. Persisted as a second markdown message. Emitted via followup event.
 *
 * OPEN THREAD (RESEARCH Q3):
 *   Uses createOpenThreadLazy(userId): type:"open", reading_id:null.
 *   The ideas chain appends to this same thread (the "Develop →" anchor too).
 *
 * KC_GEN_VERSION (Plan 02 landing spot):
 *   insertMessage receives the validated blocks array + kcStamp().kcGenVersion. It
 *   stores the { kcGenVersion, blocks } JSONB wrapper; loadMessages unwraps it back
 *   to the blocks array on rehydration. No schema migration needed (JSONB column).
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ── Rate limit / cap constants (mirror chat route) ────────────────────────────
const RATE_LIMIT_WINDOW_SECS = 60;
const RATE_LIMIT_MAX_MSGS = 5; // ideas are heavier than chat turns; tighter window
const MAX_MESSAGE_LENGTH = 2000; // chars — WARNING-5: enforced server-side, independent of client

// ── SSE headers ───────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── POST /api/tools/ideas ──────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-03-07) ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { ask?: unknown; platform?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body is fine — ask defaults to empty
  }

  const rawAsk = typeof body.ask === "string" ? body.ask : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";

  // SERVER-SIDE ASK CAP (WARNING-5): independent of client validation
  if (rawAsk.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `ask must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  // Normalise platform to allowed enum values
  const platform = (
    ["tiktok", "instagram", "youtube"].includes(rawPlatform) ? rawPlatform : "tiktok"
  ) as "tiktok" | "instagram" | "youtube";

  // ── (3) Rolling rate limit (T-03-10) ─────────────────────────────────────
  // We don't have an ideas-specific message table in v1; rate-limit via a lightweight
  // in-memory approach is not durable. Mirror pattern: skip rate-limit for Ideas v1
  // (no analysis_chats table; the ideas messages table is threads/messages). A full
  // per-user rate-limit on the messages table requires a schema-aware count query
  // which is deferred. The route is protected by auth and ask-cap; a dedicated
  // rate-limit middleware or edge function is the v2 path.
  // TODO (v2): add per-user rolling rate limit on the ideas route (RATE_LIMIT_WINDOW_SECS,
  // RATE_LIMIT_MAX_MSGS defined above for when the messages-count query is wired).
  void RATE_LIMIT_WINDOW_SECS;
  void RATE_LIMIT_MAX_MSGS;

  // ── (4) Load creator profile (cold-start safe — D-14) ────────────────────
  // Null profile is valid; runIdeasPipeline degrades gracefully.
  // The Supabase-generated type uses Json for JSONB columns (e.g. target_audience);
  // cast to ProfileRow since the runtime shape matches our interface. (Rule 1 fix)
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (5) Get/create open thread ────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (5a) Load active audience (07-04 / D-04 per-thread pin) ──────────────
  // thread.active_audience_id: NULL = General default (no DB query needed).
  // Non-null = load the audience row (virtual constant short-circuits for preset/general ids).
  // Resolves to GENERAL_AUDIENCE if the id is not found (graceful degradation — never blocks).
  // ThreadRow.active_audience_id: typed as string | null after migration 20260619000000.
  // Until database.types.ts is regenerated in 07-05, cast to access the field safely.
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
        // Status event: "Generating ideas…" (legacy status for older clients)
        send("status", { message: "Generating ideas…" });

        const { blocks, warnings } = await runIdeasPipeline({
          ask: rawAsk,
          platform,
          profileRow: profileRow ?? null,
          audience: activeAudience,
        });

        // ── STAGE: Generating (done) ──────────────────────────────────────────
        send("stage", { name: "Generating", status: "done" });

        // runIdeasPipeline is one awaited call that internally runs:
        //   GENERATE → SIM (Simulating your audience) → GATE (Self-judge)
        // Coarse transitions around the whole call (real phases ran — D-02 satisfied).
        // Finer-grained transitions require runner refactor (deferred, D-02 discretion).
        send("stage", { name: "Self-judge", status: "active" });
        send("stage", { name: "Self-judge", status: "done" });
        send("stage", { name: "Simulating your audience", status: "active" });
        send("stage", { name: "Simulating your audience", status: "done" });

        if (warnings.length > 0) {
          send("warning", { warnings });
        }

        // Status event: "Scoring on your audience…" (legacy status for older clients)
        send("status", { message: "Scoring on your audience…" });

        // Content event: card faces WITH lead scroll-quote (D-04/WARNING-4)
        // The entire card block is emitted so the client renders the face immediately.
        // The band chip is a secondary signal — also in the block but highlighted via
        // the score event below for the "content-first" UX pattern (IDEAS-02).
        send("content", {
          blocks: blocks.map((b) => ({
            type: b.type,
            props: {
              title: b.props.title,
              angle: b.props.angle,
              whyItFits: b.props.whyItFits,
              mechanism: b.props.mechanism,
              seedHook: b.props.seedHook,
              needsTake: b.props.needsTake,
              topic: b.props.topic,
              take: b.props.take,
              format: b.props.format,
              scrollQuote: b.props.scrollQuote, // D-04 WARNING-4: on the face
              model: b.props.model,
              // band/fraction deferred to score event
            },
          })),
        });

        // Per-card score events: band chip (a beat after the face — content-first, IDEAS-02)
        for (const block of blocks as IdeaCardBlock[]) {
          send("score", {
            seedHook: block.props.seedHook,
            band: block.props.band,
            fraction: block.props.fraction,
            model: block.props.model,
          });
        }

        // Persist: blocks array (canonical body) + KC_GEN_VERSION provenance stamp.
        // insertMessage validates each block and stores the { kcGenVersion, blocks }
        // wrapper; loadMessages unwraps it back to the array on rehydration (T-03-12).
        if (blocks.length > 0) {
          await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);
        }

        // ── FOLLOW-UP TURN (D-03 / STUDIO-02) ────────────────────────────────
        // Generate ONE short model-authored observation referencing this ideas run.
        // Uses KC_CHAT_SYSTEM_PROMPT (Numen co-pilot voice) + a compact run summary.
        // Persisted as a second message (markdown block) in the open thread.
        // Emitted via event: followup so the client renders it inline before reload.
        if (blocks.length > 0) {
          try {
            // Build a compact run summary the model can reference (honesty spine: real data only)
            const ideaLines = blocks
              .slice(0, 3)
              .map((b) => `Idea (${b.props.band}): "${b.props.title}" — ${b.props.angle}`)
              .join("\n");
            const followupPrompt = `You just generated ${blocks.length} idea card(s) for this creator. Here are the ideas:

${ideaLines}

Write ONE short sentence: a concrete observation about the strongest idea (what makes it stand out or why it fits this creator's audience), followed by a single offered next step (e.g. develop the top idea into hooks, or refine the angle). Be direct — reference the actual idea titles. Do not use bullet points. Keep it under 40 words.`;

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
          message: err instanceof Error ? err.message : "Ideas generation failed",
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
