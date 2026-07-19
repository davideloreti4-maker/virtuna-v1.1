/**
 * /api/tools/script — Script generation SSE route (Plan 06-03, Task 2).
 *
 * POST — authenticate, generate ONE script via runScriptPipeline (opener-only Flash gate),
 *         stream content-first (beats+timing+retention face → opener band chip),
 *         persist to user's open thread stamped with KC_GEN_VERSION.
 *
 * ONE-CARD (D-02): returns exactly one script-card per run, not N ranked cards.
 * OPENER-ONLY GATE (D-01): Flash scores the opening beat only (honesty spine).
 *
 * Security mitigations (T-06-06 – T-06-10):
 *   - Auth enforced before any DB read or LLM work (T-06-06)
 *   - Session user_id only — never from body (T-06-08 / CR-01)
 *   - Server-side ask + anchor length cap (T-06-09 / WARNING-5)
 *   - assembleBundle injection fence wraps ask + anchor (T-06-07, inside runner call)
 *   - insertMessage re-validates all blocks at write boundary (D-14)
 *   - KC_GEN_VERSION stamp on every persisted message (D-10)
 *   - Qwen-only: getQwenClient / QWEN_REASONING_MODEL (T-04-08 posture)
 *   - Rate-limit deferred to v2 (same posture as Hooks — auth + ask-cap are v1 boundary)
 *
 * STREAMING PATTERN (mirrors hooks/route.ts posture):
 *   event: stage    — { name, status: "active"|"done" } — real pipeline phases (D-02)
 *   event: content  — script-card face (beats+timing+retention+openingBeatSeed+scrollQuote)
 *   event: score    — opener band chip (a beat later — content-first, Pitfall 5)
 *   event: done     — completion signal (S2: emitted BEFORE followup — off critical path)
 *   event: followup — { text } — model-authored observation (non-fatal); streamed AFTER
 *                     done so the chat turn never blocks run completion
 *
 * STAGES (real pipeline boundaries — NO fake timers, D-02):
 *   Generating         → active before runScriptPipeline; done after
 *   Self-judge         → wraps self-judge gate (coarse, route-level)
 *   Simulating your audience → wraps the opener Flash gate (coarse, same boundary)
 *
 * OPEN THREAD:
 *   Uses createOpenThreadLazy(userId): type:"open", reading_id:null.
 *   Script appends to same open thread as Ideas/Hooks.
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runScriptPipeline } from "@/lib/tools/runners/script-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { requireSocialsAudience } from "@/lib/audience/require-socials-audience";
import { goalIntentToLens, parseIntentLens } from "@/lib/audience/intent-lens";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ── Cap constants ─────────────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000; // chars — WARNING-5: server-side, independent of client
const MAX_ANCHOR_LENGTH = 5000;  // anchor is a full hook line — allow more than a chat turn

// ── SSE headers ───────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── POST /api/tools/script ────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-06-06): before ANY DB read or LLM work ──────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — replay fixtures, no engine call ──
  const mock = await maybeMockSkillRun("script", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "script");
  if (limited) return limited;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "script");
  if (refusal) return refusal;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: {
    ask?: unknown;
    platform?: unknown;
    anchor?: unknown;
    intent?: unknown;
    allowScrape?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body is fine — ask defaults to empty
  }

  const rawAsk = typeof body.ask === "string" ? body.ask : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";
  const rawAnchor = typeof body.anchor === "string" ? body.anchor : undefined;
  // EXPLICIT-ONLY SPEND: the only field that can authorize a live Apify scrape. Default false —
  // a normal run never bills. Set true solely by the "Find new outliers" affordance (see
  // gather-for-run `allowScrape`). Coerced strictly to boolean; anything non-`true` is false.
  const allowScrape = body.allowScrape === true;

  // SERVER-SIDE ASK CAP (WARNING-5): independent of client validation (T-06-09)
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

  // ── (3) user_id from session ONLY, never body (CR-01 / T-06-08) ──────────
  // user.id is from supabase.auth.getUser() — never from request body

  // ── (4) Load creator profile (cold-start safe) ────────────────────────────
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (5) Get/create open thread ────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (5a) Load active audience (08-04 / D-04 per-thread pin — shared helper) ──
  // thread.active_audience_id: NULL = General default; non-null = load under the session.
  // Falls back to General on a missing id or a load failure (non-fatal). Id is NEVER from
  // the request body — session/thread only (CR-01).
  const activeAudience = await resolveThreadAudience(supabase, openThread, user.id);

  // ── MODE-01 — the socials-skill guard (server half of the mode seam) ─────────
  // script is socials-shaped by construction. A `mode: 'general'` audience (a panel, a
  // named person) is not a crowd on a feed — refuse it rather than write feed content for it.
  // The composer already hides this skill for a general audience; this catches a stale
  // client, a restored thread, and any direct API call.
  {
    const refusal = requireSocialsAudience(activeAudience, "script");
    if (refusal) return refusal;
  }

  // ── (5b) Resolve per-run intent (GAP-C2 / §P.10) ──────────────────────────
  // Explicit composer override wins; else default from the audience's goal_intent (4→2 lens).
  // The runner gates this to undefined for General/no-audience (no-op, regression gate).
  const effectiveIntent = parseIntentLens(body.intent) ?? goalIntentToLens(activeAudience.goal_intent);

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
        // Stage events now stream from the REAL pipeline boundaries (Generating → Simulating
        // your audience) via onStage — the spine reflects genuine phase timing instead of a
        // single opaque await + a burst (D-02: real boundaries, no fake timers).
        const { blocks, warnings, scrapeAvailable } = await runScriptPipeline({
          ask: rawAsk,
          platform,
          profileRow: profileRow ?? null,
          anchor: rawAnchor,
          audience: activeAudience,
          intent: effectiveIntent,
          allowScrape,
          onStage: (name, status) => send("stage", { name, status }),
          // FLYWHEEL-02: pin the predicted vector for this run (text skill → no analysis).
          pin: { supabase, analysisId: null },
        });

        if (warnings.length > 0) {
          send("warning", { warnings });
        }

        // OUTLIERS OFFER: this run couldn't ground itself, but a live scrape could find proven
        // outliers on the subject. The server owns this call (grounding on, platform scrapable,
        // cache thin) so the client never guesses — it just renders "Find new outliers" when told.
        if (scrapeAvailable) {
          send("outliers", { available: true });
        }

        // ── CONTENT event: script face FIRST (beats+timing+retention+openingBeatSeed+scrollQuote) ──
        // band/fraction deferred to score event (content-first — Pitfall 5 honesty timing)
        send("content", {
          blocks: blocks.map((b) => ({
            type: b.type,
            props: {
              beats: b.props.beats,
              openingBeatSeed: b.props.openingBeatSeed,
              scrollQuote: b.props.scrollQuote,
              model: b.props.model,
              personas: b.props.personas,       // S3′: real per-persona reactions → named ambient Room cast (Task B)
              proof: b.props.proof,             // §11f: receipt streams WITH the face (mirrors hooks)
              grounded: b.props.grounded,       // §11f: the RUN had sources even if this card cited none — gates NoSourceNote
              population: b.props.population,    // Audience Sim v2 Stage 2: the N-individual projection → Population·1,000 Sheet (rides the face)
              // band/fraction deferred to score event (content-first)
            },
          })),
        });

        // ── SCORE event: opener band chip (a beat after the face — content-first) ──
        for (const block of blocks as ScriptCardBlock[]) {
          send("score", {
            openingBeatSeed: block.props.openingBeatSeed,
            band: block.props.band,
            fraction: block.props.fraction,
            model: block.props.model,
          });
        }

        // ── PERSIST: blocks + KC_GEN_VERSION provenance stamp (D-10) ─────────
        if (blocks.length > 0) {
          await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);
        }

        // ── DONE (S2): emit BEFORE the follow-up turn ────────────────────────
        // Cards are scored + persisted — the run's critical path is complete. The
        // follow-up chat turn below used to block `done`, holding the SSE open and the
        // UI in "streaming" for the seconds the follow-up takes. Emit `done` now; the
        // follow-up streams in afterward (client read loop runs until the server closes).
                // BILL — on delivery only: the cards are persisted above; a run that died
        // never reaches this line, so it never charges.
        if (blocks.length > 0) {
          await billUsage({ userId: user.id, action: "script", tier: creditVerdict.tier });
        }

        send("done", { count: blocks.length });

        // ── FOLLOW-UP TURN (mirrors hooks/route.ts posture) — off critical path (S2) ──
        // One-shot Qwen call — model-authored observation referencing this script run.
        // Non-fatal: caught silently so script-card delivery never blocks on follow-up.
        if (blocks.length > 0) {
          try {
            const card = blocks[0];
            if (!card) throw new Error("no card");
            const beatLabels = card.props.beats
              .slice(0, 3)
              .map((b) => `${b.label}: "${b.content.slice(0, 80)}"`)
              .join("\n");
            const followupPrompt = `You just generated a script for this creator. Here are the key beats:

${beatLabels}

Write ONE short sentence: a concrete observation about the script's structure (what's strong about the opener, an interesting beat transition, or a craft pattern), followed by a single offered next step (refine a beat, test the hook on SIM-1 Max, or turn this into a Remix). Be direct and specific — reference the actual beats. Do not use bullet points. Keep it under 40 words.`;

            const ai = getQwenClient();
            let followupText = "";
            const followupParams = {
              model: QWEN_REASONING_MODEL,
              messages: [
                { role: "system" as const, content: KC_CHAT_SYSTEM_PROMPT },
                { role: "user" as const, content: followupPrompt },
              ],
              stream: true as const,
              temperature: 0.4,
              max_tokens: 2000, // safety ceiling: short follow-up, bound runaway
            };
            (followupParams as Record<string, unknown>).enable_thinking = false; // DashScope extension: thinking-off
            const followupStream = await ai.chat.completions.create(followupParams);
            for await (const chunk of followupStream) {
              followupText += chunk.choices[0]?.delta?.content ?? "";
            }

            if (followupText.trim()) {
              await insertMessage(
                openThread.id,
                "assistant",
                [{ type: "markdown", props: { text: followupText.trim() } }],
                kcStamp().kcGenVersion,
              );
              send("followup", { text: followupText.trim() });
            }
          } catch {
            // Follow-up failure is non-fatal — don't error the whole run
          }
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Script generation failed",
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
