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
 *   event: done    — signal completion (S2: emitted BEFORE followup — off critical path)
 *   event: FOLLOWUP — { text: string } — model-authored turn referencing this run (D-03);
 *                     streamed AFTER done so the chat turn never blocks run completion
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
import { createOpenThreadLazy, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { requireSocialsAudience } from "@/lib/audience/require-socials-audience";
import { goalIntentToLens, parseIntentLens } from "@/lib/audience/intent-lens";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
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

  // ── Layer 2 mock short-circuit (dev only) — replay fixtures, no engine call ──
  const mock = await maybeMockSkillRun("hooks", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "hooks");
  if (limited) return limited;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "hooks");
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
  // a normal run never bills. Set true solely by the "Find new outliers" affordance the user taps
  // (see gather-for-run `allowScrape`). Coerced strictly to boolean; anything non-`true` is false.
  const allowScrape = body.allowScrape === true;

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

  // ── (5a) Load active audience (08-04 / D-04 per-thread pin — shared helper) ──
  // thread.active_audience_id: NULL = General default; non-null = load under the session.
  // Falls back to General on a missing id or a load failure (non-fatal). Id is NEVER from
  // the request body — session/thread only (CR-01).
  const activeAudience = await resolveThreadAudience(supabase, openThread, user.id);

  // ── MODE-01 — the socials-skill guard (server half of the mode seam) ─────────
  // hooks is socials-shaped by construction. A `mode: 'general'` audience (a panel, a
  // named person) is not a crowd on a feed — refuse it rather than write feed content for it.
  // The composer already hides this skill for a general audience; this catches a stale
  // client, a restored thread, and any direct API call.
  {
    const refusal = requireSocialsAudience(activeAudience, "hooks");
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
        // Status event: generation starting (legacy status for older clients)
        send("status", { message: "Generating hooks…" });

        // Stage events now stream from the REAL pipeline boundaries (Generating → Simulating
        // your audience → Ranking) via onStage — the spine reflects genuine phase timing instead
        // of a single opaque await + an end-of-run burst (D-02: real boundaries, no fake timers).
        const { blocks, warnings, scrapeAvailable } = await runHooksPipeline({
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
        // outliers on the subject. The server owns this call — it knows grounding is on, the
        // platform is scrapable, and the cache came up thin — so the client never guesses; it just
        // renders the "Find new outliers" affordance when told a scrape would actually do something.
        if (scrapeAvailable) {
          send("outliers", { available: true });
        }

        // Status event (legacy, for older clients). New Qwen call system (2026-07-22): there is no
        // separate "scoring" pass — the projected /10 rode the single generation call, and the cards
        // are now ranked off it. Say "Ranking hooks…", not the old "Scoring on your audience…" which
        // would claim a persona reaction that no longer runs on the generation path.
        send("status", { message: "Ranking hooks…" });

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
              visualHook: b.props.visualHook,               // owner 2026-07-22: first-frame visual rides the FACE (else reload-only, per proof/target hazard below)
              provenance: b.props.provenance,               // new call system: "projected" must ride the FACE — else the live card reads "measured"
                                                            // ("stopped" / "SIM-1 Flash") and only self-corrects to "would stop / projected" after a
                                                            // reload. The whole honesty point is that a projection never claims a measurement it didn't run.
              personas: b.props.personas,                   // S3′: real per-persona reactions → named ambient Room cast (Task B)
              proof: b.props.proof,                         // §11f: receipt streams WITH the face (was dropped → receipts only appeared after reload)
              target: b.props.target,                       // per-persona generation: WHO this hook was written for + how they reacted
              grounded: b.props.grounded,                   // §11f: the RUN had sources even if this card cited none. Gates NoSourceNote —
                                                            // dropped here, the note could only ever appear after a reload (see `proof` above:
                                                            // same bug, same line, fixed once and immediately reintroduced one field later).
              population: b.props.population,               // Audience Sim v2 Stage 2: the N-individual projection → Population·1,000 Sheet.
                                                            // Same reload-only hazard as proof/target above — must ride the face, not just persist.
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

          // Title the thread from the most topical signal this run carries:
          // typed ask > carried anchor (idea concept) > rank-1 hook line. Auto
          // runs persist NO user turn, so without this every hooks thread was
          // titled from the follow-up message ("Hook #1 wins by…" × N identical).
          // Write-once + best-effort — never fails the run.
          const rankOne =
            (blocks as HookCardBlock[]).find((b) => b.props.rank === 1) ??
            (blocks as HookCardBlock[])[0];
          await setThreadTitleIfEmpty(
            user.id,
            openThread.id,
            rawAsk || rawAnchor || rankOne?.props.hookLine,
          );
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
          await billUsage({ userId: user.id, action: "hooks", tier: creditVerdict.tier });
        }

        send("done", { count: blocks.length });

        // ── FOLLOW-UP TURN (D-03 / STUDIO-02) — off the critical path (S2) ───
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
