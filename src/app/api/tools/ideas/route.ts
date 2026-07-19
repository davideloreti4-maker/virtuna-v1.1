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
 *   event: done    — signal completion (S2: emitted BEFORE followup — off critical path)
 *   event: FOLLOWUP — { text: string } — model-authored turn referencing this run (D-03);
 *                     streamed AFTER done so the chat turn never blocks run completion
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
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { requireSocialsAudience } from "@/lib/audience/require-socials-audience";
import { goalIntentToLens, parseIntentLens } from "@/lib/audience/intent-lens";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ── Message cap constant ──────────────────────────────────────────────────────
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

  // ── Layer 2 mock short-circuit (dev only) — replay fixtures, no engine call ──
  const mock = await maybeMockSkillRun("ideas", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01 / E1) ────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "ideas");
  if (limited) return limited;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "ideas");
  if (refusal) return refusal;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { ask?: unknown; platform?: unknown; intent?: unknown; allowScrape?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body is fine — ask defaults to empty
  }

  const rawAsk = typeof body.ask === "string" ? body.ask : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";
  // EXPLICIT-ONLY SPEND: the only field that can authorize a live Apify scrape. Default false —
  // a normal run never bills. Set true solely by the "Find new outliers" affordance (see
  // gather-for-run `allowScrape`). Coerced strictly to boolean; anything non-`true` is false.
  const allowScrape = body.allowScrape === true;

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
  // Enforced durably at the auth gate above by rateLimitGuard(user.id, "ideas")
  // (Upstash sliding window; the heavier ideas pipeline gets a tighter cap).

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

  // ── (5a) Load active audience (07-04 / D-04 per-thread pin — shared helper) ──
  // thread.active_audience_id: NULL = General default; non-null = load under the session.
  // Resolves to General on a missing id or a load failure (graceful degradation — never blocks).
  const activeAudience = await resolveThreadAudience(supabase, openThread, user.id);

  // ── MODE-01 — the socials-skill guard (server half of the mode seam) ─────────
  // ideas is socials-shaped by construction. A `mode: 'general'` audience (a panel, a
  // named person) is not a crowd on a feed — refuse it rather than write feed content for it.
  // The composer already hides this skill for a general audience; this catches a stale
  // client, a restored thread, and any direct API call.
  {
    const refusal = requireSocialsAudience(activeAudience, "ideas");
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
        // Status event: "Generating ideas…" (legacy status for older clients)
        send("status", { message: "Generating ideas…" });

        // Stage events now stream from the REAL pipeline boundaries (Generating → Simulating
        // your audience → Ranking) via onStage — the spine reflects genuine phase timing instead
        // of a single opaque await + an end-of-run burst (D-02: real boundaries, no fake timers).
        const { blocks, warnings, scrapeAvailable } = await runIdeasPipeline({
          ask: rawAsk,
          platform,
          profileRow: profileRow ?? null,
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
              personas: b.props.personas,       // S3′: real per-persona reactions → named ambient Room cast (Task B)
              proof: b.props.proof,             // §11f: receipt streams WITH the face (mirrors hooks)
              grounded: b.props.grounded,       // §11f: the RUN had sources even if this card cited none — gates NoSourceNote
              target: b.props.target,           // per-persona generation: WHO this idea was written for + how they reacted
              population: b.props.population,    // Audience Sim v2 Stage 2: the N-individual projection → Population·1,000 Sheet.
                                                // Same reload-only hazard as proof above — must ride the face, not just persist.
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

        // ── DONE (S2): emit BEFORE the follow-up turn ────────────────────────
        // The cards are scored + persisted here — that's the run's critical path.
        // The follow-up chat turn (a streamed Qwen call below) used to block `done`,
        // keeping the client stream open and the UI in its "streaming" state for the
        // several seconds the follow-up takes. Emitting `done` now lets the client
        // unblock immediately; the follow-up streams in afterward on the still-open
        // SSE (the client read loop keeps consuming until the server closes it).
                // BILL — on delivery only: the cards are persisted above; a run that died
        // never reaches this line, so it never charges.
        if (blocks.length > 0) {
          await billUsage({ userId: user.id, action: "ideas", tier: creditVerdict.tier });
        }

        send("done", { count: blocks.length });

        // ── FOLLOW-UP TURN (D-03 / STUDIO-02) — off the critical path (S2) ───
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
