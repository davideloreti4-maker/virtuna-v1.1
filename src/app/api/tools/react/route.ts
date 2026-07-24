/**
 * /api/tools/react — type-to-room reaction route (Plan 13-01, Task 2).
 *
 * POST — the ONLY new model-calling code in Phase 13 (Ambient Numen). Fires ONE Flash
 * text-mode reaction for an ad-hoc thought typed into the ambient presence and returns the
 * real { fraction, scrollQuote } the client turns into a spotlight + Lens (D-04). Type-to-room
 * is "test a thought against my people" without running a full skill — the ambient cheatcode.
 *
 * Reuses the SHIPPED primitives (the "extend, don't duplicate" mandate — never rebuilds):
 *   - runFlashTextMode (the Flash text-mode reaction primitive every card already uses)
 *   - buildReactionPanel (the shared niche-resolution + audience-repaint helper — Task 1)
 *   - aggregateFlash (the pure { band, fraction } aggregate; honesty: no numeric score)
 *
 * Honesty / moat posture (the failure modes this route must NOT hit):
 *   - Pitfall 1: NEVER reuse /api/tools/chat (it streams MARKDOWN, not a stop/scroll reaction).
 *     This route returns JSON { fraction, scrollQuote } — no streaming, no markdown, no event-stream.
 *   - Pitfall 2: build the niche panel via buildReactionPanel (resolveNicheKey path) so a typed
 *     thought in a real niche returns a DISCRIMINATING band — not the niche-blind "all Mixed" miss.
 *
 * Security (mirrors the ideas route — CR-01):
 *   - Auth enforced before any DB read.
 *   - The active audience is resolved SERVER-SIDE off the user's open thread
 *     (thread.active_audience_id → getAudience). NEVER from the request body.
 *
 * Engine posture: NO ENGINE_VERSION bump (text path, Qwen-only, reuses the shipped primitive).
 *   NO persistence — type-to-room is ephemeral (RESEARCH Open Q3 default).
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { GENERAL_BASELINE_SIGNATURE } from "@/lib/audience/general-baseline-signature";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { pinPredictedSignature } from "@/lib/tools/runners/predicted-pin";
import { writeSimSeal } from "@/lib/threads/sim-seals";
import { characterizeContent } from "@/lib/audience/characterize-content";
import {
  reactPopulation,
  signatureHasPopulationAxes,
  type ContentVector,
  type PopulationAggregate,
} from "@/lib/audience/population";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

// ── Request body schema (CLAUDE.md boundary rule) ──────────────────────────────
// text: a non-whitespace thought; framing: optional, defaults to "hook" (RESEARCH A1 —
// first-2s "do you stop?", matching every card-level reaction). NO audience id in the body —
// the audience is server-resolved off the open thread (CR-01).
const ReactBodySchema = z.object({
  text: z.string().trim().min(1, "text must be a non-empty thought"),
  framing: z.enum(["hook", "idea"]).optional(),
  // Per-run reaction lens (GAP-C2 / §P.10) — composer override; absent → audience default.
  intent: z.enum(["grow", "sell"]).optional(),
  // Opt-in FLYWHEEL capture (Ambient v2 Phase D). Default OFF → type-to-room stays ephemeral +
  // pins nothing. The Ambient v2 Overview's DELIBERATE "Simulate →" sets it: a fired sim pins its
  // PREDICTED disposition vector for later reconciliation (relocates the orphaned pin onto a real
  // fired sim). The pin persists an outcome-signature row ONLY — never the thought/reaction (react
  // stays ephemeral for the reaction itself). Non-fatal: a pin failure never blocks the reaction.
  pin: z.boolean().optional(),
  // Opt-in SEAL persistence (Ambient v2 Phase D). Default OFF → type-to-room writes nothing. The
  // v2 Overview's deliberate sim sets it: the sealed verdict (pct + band) is written to the open
  // thread's `sim_seals` keyed by the trimmed stimulus, so the Overview seal SURVIVES a reload.
  // Orthogonal to `pin` (flywheel vs UI-state); non-fatal, never blocks the reaction.
  persist: z.boolean().optional(),
});

// ── Lead scroll-quote selector ─────────────────────────────────────────────────
// Inlined per RESEARCH A4 — selectLeadScrollQuote is private per-runner (not exported);
// the four runners each duplicate it, so matching that precedent is the chosen path.
// Priority: first stop-verdict persona's quote (they stopped → their quote is the pull signal).
// Fallback: first persona's quote regardless of verdict (persona count guaranteed ≥1).
function selectLeadScrollQuote(personas: FlashPersona[]): string {
  const stopper = personas.find((p) => p.verdict === "stop");
  if (stopper) return stopper.quote;
  return personas[0]?.quote ?? "";
}

// ── POST /api/tools/react ───────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (CR-01) — before any DB read ─────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("react", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01 / E1) ────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "react");
  if (limited) return limited;

  // ── (2) Parse + Zod-validate body (CLAUDE.md boundary) ─────────────────────
  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    // Malformed JSON → fails the schema below → 400
  }
  const parsed = ReactBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", detail: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { text, framing, intent: bodyIntent, pin: wantPin, persist: wantPersist } = parsed.data;

  // ── (3) Load creator profile (cold-start safe — null profile is valid) ─────
  // Same select the ideas route uses; the runtime shape matches ProfileRow.
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (4) Resolve the active audience SERVER-SIDE (CR-01 — never from the body) ─
  // Read active_audience_id off the user's open thread, then resolve under the session.
  // NULL = General default; a missing id or load failure degrades to General (never blocks).
  const openThread = await createOpenThreadLazy(user.id);
  const audience = await resolveThreadAudience(supabase, openThread, user.id);

  // ── (5) Build the niche panel + audience repaint (shared helper — Task 1) ───
  // The SAME construction ideas-runner / hooks-runner use, so the typed thought
  // discriminates by niche exactly like a card reaction (RESEARCH Open Q1 / Pitfall 2).
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── (5b) Resolve per-run intent (GAP-C2 / §P.10) ───────────────────────────
  // Override wins; else default from goal_intent (4→2). Gated to calibrated audiences only
  // (General/no-audience → undefined no-op, regression gate). grow is also a no-op in the SIM.
  const simIntent: IntentLens | undefined =
    audience && !audience.is_general
      ? bodyIntent ?? goalIntentToLens(audience.goal_intent)
      : undefined;

  // ── (6) Fire the Flash reaction AND characterize the content CONCURRENTLY ──
  // The population aggregate (Audience Sim v2 Stage 2) needs the content scored into the
  // signature's named axes — one extra LLM call. It does NOT depend on the flash result,
  // so it runs in PARALLEL (no serial latency added). A calibrated signature with v2 axes
  // is the gate; General / legacy / preset signatures skip it (byte-identical old behaviour).
  // The signature that drives the population projection. A calibrated audience uses its own frozen
  // signature; General (uncalibrated) has none, so it falls back to the honest GENERIC BASELINE
  // (general-baseline-signature.ts) — so a new user still lands on the SAME Population room. Injected
  // HERE only (the population boundary), never baked onto the GENERAL_AUDIENCE constant, so no other
  // route/reveal/tier path is affected. Presets stay null → verdict-only (no baseline for them).
  const populationSignature =
    audience?.signature ?? (audience?.is_general ? GENERAL_BASELINE_SIGNATURE : null);
  const wantPopulation =
    !!populationSignature && signatureHasPopulationAxes(populationSignature);
  const contentVectorPromise: Promise<ContentVector | null> = wantPopulation
    ? characterizeContent(text, populationSignature!.audience.topic_vocab ?? []).catch(() => null)
    : Promise.resolve(null);

  // default framing "hook" (first-2s "do you stop?" — RESEARCH A1). The client shows
  // "Reading the room…" for the one ~8-17s call. On failure → honest 502 (the client
  // renders the retry copy, never error-red). The concurrent characterize already has a
  // .catch, so a flash short-circuit here leaves no unhandled rejection.
  let personas: FlashPersona[];
  try {
    const { result } = await runFlashTextMode(text, framing ?? "hook", panel, audienceRepaint, simIntent);
    personas = result.personas;
  } catch {
    return Response.json({ error: "reaction_failed" }, { status: 502 });
  }

  // ── (7) Aggregate → { fraction, scrollQuote } (the exact shape the client feeds
  //         to cardScrollQuoteReactions → spotlight + Lens) ─────────────────────
  const { band, fraction } = aggregateFlash(personas);
  const scrollQuote = selectLeadScrollQuote(personas);

  // ── (7a) FLYWHEEL pin (Ambient v2 Phase D, opt-in) ─────────────────────────
  // A DELIBERATE Overview sim (pin:true) captures its PREDICTED disposition vector for later
  // reconciliation — the relocation of the once-orphaned `pinPredictedSignature` onto a real fired
  // sim. audience_id is pinned ONLY for a persisted audience (a virtual constant — General / preset /
  // template — carries `user_id:"__virtual__"` and no DB row, so it pins a null audience per the
  // pin contract's "null for General/no-audience"). Non-fatal by contract: never throws, never
  // blocks the reaction. analysis_id is null — a concept-sim has no posted-video outcome yet.
  if (wantPin) {
    await pinPredictedSignature(supabase, personas, {
      audienceId: audience.user_id === "__virtual__" ? null : audience.id,
    });
  }

  // ── (7b) Population aggregate — the honest N-individual projection (Stage 2) ─
  // A REAL O(N) score of ~1,000 individuals sampled off the signature's 10 segments, not
  // the 10's rollup at higher resolution. Pure math once characterize() lands; a null
  // vector (skip / failure) → no population, and the client falls back to the rollup swarm.
  const contentVector = await contentVectorPromise;
  let population: PopulationAggregate | null = null;
  if (contentVector && populationSignature) {
    try {
      population = reactPopulation(populationSignature, contentVector);
    } catch {
      population = null; // never let the projection break the reaction
    }
  }

  // ── (7c) SEAL persistence (Ambient v2 Phase D verdict + Phase C depth, opt-in) ─
  // A DELIBERATE Overview sim (persist:true) writes its sealed verdict (pct + band) AND the depth
  // payload (the Stage-2 `population` projection + the exemplar `personas` + `scrollQuote`) to the
  // open thread's `sim_seals`, keyed by the trimmed stimulus, so BOTH the Overview seal and the
  // audience-depth drill survive a reload. pct is the honest "N/10 stop" fraction as a percentage; an
  // unparseable fraction writes nothing (never fabricate a seal). Runs AFTER the population compute so
  // the depth rides along. `population` is now non-null for General too (the generic baseline
  // projection) → its seal carries the Population depth like a calibrated one; only presets stay
  // verdict-only. Non-fatal (writeSimSeal swallows failures) — never blocks the reaction.
  if (wantPersist) {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction);
    const pct =
      m && Number(m[2]) > 0
        ? Math.max(0, Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100)))
        : null;
    if (pct !== null) {
      await writeSimSeal(supabase, openThread, text, {
        pct,
        band: band ?? null,
        at: new Date().toISOString(),
        population,
        personas,
        scrollQuote,
      });
    }
  }

  // ── (8) Return the reaction (NO persistence — type-to-room is ephemeral) ───
  // Also return the full per-persona reactions (real registry-enum archetypes) so the
  // ambient Room shows the NAMED People cast + the "Ask them why →" chat for a typed
  // thought — same as a generated card's own S3′ personas (The Room, Task B). Shape is
  // { archetype, verdict, quote } (FlashPersona) — the exact AmbientPersonaReaction shape.
  // `population` is the Stage 2 projection (null when the audience lacks v2 axes).
  return Response.json({ fraction, scrollQuote, personas, population });
}
