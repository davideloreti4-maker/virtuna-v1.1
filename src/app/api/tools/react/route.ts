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
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { createLogger } from "@/lib/logger";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { GENERAL_BASELINE_SIGNATURE } from "@/lib/audience/general-baseline-signature";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { sceneToDomain } from "@/lib/engine/flash/flash-prompts";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import type { DomainLens } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { pinPredictedSignature } from "@/lib/tools/runners/predicted-pin";
import { writeSimSeal } from "@/lib/threads/sim-seals";
import { characterizeContent } from "@/lib/audience/characterize-content";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import {
  reactPopulation,
  signatureHasPopulationAxes,
  type ContentVector,
  type PopulationAggregate,
} from "@/lib/audience/population";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

const log = createLogger({ module: "tools.react" });

// ── Request body schema (CLAUDE.md boundary rule) ──────────────────────────────
// text: a non-whitespace thought; framing: optional, defaults to "hook" (RESEARCH A1 —
// first-2s "do you stop?", matching every card-level reaction). NO audience id in the body —
// the audience is server-resolved off the open thread (CR-01).
const ReactBodySchema = z.object({
  text: z.string().trim().min(1, "text must be a non-empty thought"),
  framing: z.enum(["hook", "idea"]).optional(),
  // Per-run reaction lens (GAP-C2 / §P.10) — composer override; absent → audience default.
  intent: z.enum(["grow", "sell"]).optional(),
  // ── ⑤'s ARM dials (2026-07-28). Every one of these was collected by the ARM screen and
  // discarded by its caller, so every run was the audience default no matter what was picked.
  //
  // The BEHAVIOUR the room is scored for — ⑤'s loud dial. Absent → "stop", the engine's existing
  // default, which emits no directive and is byte-identical to the pre-lens message.
  lens: z.enum(["stop", "finish", "share", "follow", "buy"]).optional(),
  // How they ENCOUNTER it. Maps to the engine's DomainLens: "No feed" → the merit-judging panel
  // frame, anything else → the scrolling-FYP frame. Only scenes with a real frame are ever offered.
  scene: z.string().trim().min(1).optional(),
  // WHICH SLICE to read — an engine ARCHETYPE, never a display label (the labels are creator-
  // editable). Absent → the whole room. A slice is answered from the population projection's own
  // per-archetype split, so it is honoured only when that projection exists (see `slice` below).
  segment: z.string().trim().min(1).optional(),
  // The picked slice's DISPLAY label, for the card's disclosure line only — never for identifying
  // a slice (that is `segment`). It is creator-editable text the ARM screen owns, so the client is
  // its correct source; absent ⇒ the card falls back to the raw archetype rather than inventing a
  // name. (The humaniser lives in `src/lib/surfaces/**`, which an API route MUST NOT import — that
  // import drags the client component graph into the server bundle and breaks `npm run build`.)
  segmentLabel: z.string().trim().min(1).max(80).optional(),
  // Opt-in FLYWHEEL capture (Ambient v2 Phase D). Default OFF → type-to-room stays ephemeral +
  // pins nothing. The Ambient v2 Overview's DELIBERATE "Simulate →" sets it: a fired sim pins its
  // PREDICTED disposition vector for later reconciliation (relocates the orphaned pin onto a real
  // fired sim). The pin persists an outcome-signature row ONLY — never the thought/reaction (react
  // stays ephemeral for the reaction itself). Non-fatal: a pin failure never blocks the reaction.
  pin: z.boolean().optional(),
  // ── The ＋ door's card (2026-07-28, Phase 4) ────────────────────────────────────────────────
  // Opt-in THREAD CARD. Default OFF → nothing is inserted and every existing caller is
  // byte-identical (type-to-room and the composer's `ask` verb stay ephemeral; the rail's own
  // "Simulate →" already has a card — the one the skill generated — and must not get a second).
  //
  // Set ONLY by the ＋ door, and it is what stops that path from producing an ORPHAN SEAL:
  // `persist` writes a seal keyed by this text, seals are read through DESCRIPTORS, and descriptors
  // derive purely from rendered card blocks. A brought stimulus with no block therefore seals a row
  // that renders NOWHERE. `card` inserts the `brought-card` whose `stimulus` IS the seal key.
  card: z.boolean().optional(),
  // What the creator called it at the door (draft / hook / idea / script) — carried onto the card
  // so it names the artifact honestly instead of being labelled as one of the four generated kinds.
  cardKind: z.enum(["draft", "hook", "idea", "script"]).optional(),
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

  // ── (1a) THE WALL (ONBOARDING-FUNNEL-DESIGN.md §0b②) — a react run IS a simulation
  // verdict, which is what an anonymous /go visitor's $1 buys. Refused BEFORE any engine
  // call or credit spend: running the sim and then withholding the result would spend the
  // demo pool on an answer nobody sees. The client drops its watcher on the non-OK
  // response and the row stays honestly queued.
  if (isSealedVisitor(user)) {
    return Response.json({ error: "verdict_sealed" }, { status: 403 });
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

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  // ⚠️ THIS ROUTE WAS FREE until 2026-07-28. It is real engine spend (a Flash panel run, plus
  // a characterizeContent call on a v2-axis audience) and the `＋ Test something of your own`
  // door promotes it to a primary action, so the owner priced it at 1 credit under its own
  // `react` key. That makes the composer's "Ask the room" cost a credit — intended, not a
  // side effect.
  //
  // No customer sees a 402 the day this ships: `creditGate` only refuses when
  // BILLING_ENFORCE_QUOTA is on (off in production) — while `billUsage` starts metering
  // immediately, which is the point of landing the gate before the door.
  //
  // ⚠️ The ONE case enforcement does NOT wait for that flag is an anonymous visitor
  // (`enforced = isAnonymous || isQuotaEnforced()` — quota.ts). It cannot be reached here
  // only because THE WALL at (1a) already 403s every anonymous session before this line. If
  // that wall ever moves or goes, this gate starts refusing /go visitors with
  // `trial_required` — react is not the DEMO_ACTION, so the demo does not cover it.
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user, "react");
  if (refusal) return refusal;

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
  const {
    text,
    framing,
    intent: bodyIntent,
    pin: wantPin,
    persist: wantPersist,
    card: wantCard,
    cardKind,
    lens = "stop",
    scene,
    segment,
    segmentLabel,
  } = parsed.data;

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

  // ── (5c) Resolve the reaction FRAME (MODE-01 + ⑤'s scene dial) ──────────────
  // Two independent reasons to drop the scrolling-FYP frame, so it is a union, not a precedence:
  //   - the AUDIENCE is a panel (`mode: 'general'` — an analyst panel, a hiring panel, one named
  //     person). They are not scrolling anything, whatever scene is picked.
  //   - the RUN picks "No feed" — the creator wants to know how it lands away from a feed.
  // ⚠️ This route passed NO domain until 2026-07-28, so it was the one text-mode caller that
  // ignored `audience.mode` and fed a general-mode audience the TikTok-FYP prompt. It now agrees
  // with two-audience-read.ts and simulate-runner.ts, which have always derived it this way.
  const domain: DomainLens =
    audience.mode === "general" || (scene ? sceneToDomain(scene) : "socials") === "general"
      ? "general"
      : "socials";

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
  // ⚠️ ANNOUNCE THE SKIP (2026-08-05). A run that cannot project is the single cause of the "dead
  // drill": the row still seals on the flash fraction, so the Overview looks healthy while Brain /
  // Engagement / Audience can never open. That failure was previously invisible — no log, no Sentry,
  // no UI state — and cost two full sessions to find. It is NOT hypothetical: an audience row that
  // predates the signature pipeline (`signature: null`, `is_general: false`) falls straight through
  // the fallback above, and so does one whose signature carries no v2 axes (no `topic_vocab`, or no
  // persona with a `reaction`). Both are legacy shapes the CURRENT calibrate path no longer writes.
  if (!wantPopulation) {
    log.warn("population skipped — the depth drill will not open for this run", {
      audienceId: audience.id,
      audienceMode: audience.mode,
      isGeneral: audience.is_general,
      hasSignature: !!audience.signature,
      // Distinguishes the two legacy shapes: no signature at all vs. a signature without v2 axes.
      reason: !populationSignature ? "no_signature_and_not_general" : "signature_has_no_population_axes",
    });
  }
  const contentVectorPromise: Promise<ContentVector | null> = wantPopulation
    ? characterizeContent(text, populationSignature!.audience.topic_vocab ?? []).catch((err) => {
        // Was `.catch(() => null)` — a bare swallow. The projection is still non-fatal (the reaction
        // must survive), but a throw here silently kills the drill, so it no longer passes unseen.
        log.warn("characterizeContent failed — population will be null", {
          audienceId: audience.id,
          err: err instanceof Error ? err.message : String(err),
        });
        return null;
      })
    : Promise.resolve(null);

  // default framing "hook" (first-2s "do you stop?" — RESEARCH A1). The client shows
  // "Reading the room…" for the one ~8-17s call. On failure → honest 502 (the client
  // renders the retry copy, never error-red). The concurrent characterize already has a
  // .catch, so a flash short-circuit here leaves no unhandled rejection.
  let personas: FlashPersona[];
  try {
    const { result } = await runFlashTextMode(
      text,
      framing ?? "hook",
      panel,
      audienceRepaint,
      simIntent,
      domain,
      lens,
    );
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
    } catch (err) {
      population = null; // never let the projection break the reaction
      // …but never let it fail QUIETLY either: this is the last of the three silences that made a
      // dead drill undebuggable (the other two are the skip + the characterize catch above).
      log.warn("reactPopulation threw — population will be null", {
        audienceId: audience.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── (7b′) THE SLICE — the picked slice's own verdict (⑤'s segment dial) ─────
  // A slice is READ OUT of the projection that already ran, never simulated separately, and that
  // is a deliberate design decision worth stating:
  //
  //   The 10-archetype LLM panel CANNOT be filtered to one slice. Its prompt carries a "Critical
  //   Divergence Requirement" — the ten verdicts MUST differ by profile — so feeding it ten copies
  //   of one archetype asks for divergence from identical inputs. And a fraction taken from the
  //   one-or-two matching slots ("1/1 stop") is noise dressed as a measurement.
  //
  //   `reactPopulation` already scores ~1,000 sampled individuals and reports a REAL per-archetype
  //   split. `segments[i].total` is `share × N` — which is exactly the headcount the ARM screen
  //   promises ("410 minds · the builders slice · 41% of the room"). So the honest slice verdict
  //   already exists on every run; it just had no way to be asked for.
  //
  // A slice is therefore honoured only where the projection exists. When it does not (a signature
  // with no v2 axes, or a characterize failure) the run is NOT quietly answered with the room's
  // number under a slice's name — it comes back `honored: false` with a reason for the client to
  // show. Fail visible: a wrong slice verdict is worse than an unavailable one.
  const slice = ((): {
    archetype: string;
    honored: boolean;
    stopPct?: number;
    total?: number;
    reason?: string;
  } | null => {
    if (!segment) return null; // "Everyone" — the whole-room run, unchanged
    const seg = population?.segments.find((s) => s.archetype === segment);
    if (!seg) {
      return {
        archetype: segment,
        honored: false,
        reason: population
          ? "this audience has no such slice"
          : "this audience's signature can't be projected into slices yet",
      };
    }
    return { archetype: segment, honored: true, stopPct: seg.stopPct, total: seg.total };
  })();

  // ── (7b″) THE ＋ DOOR'S CARD — what makes a brought stimulus land as a row (opt-in) ─────────
  //
  // THE TRAP THIS CLOSES: `persist` writes a SEAL and this route writes no message at all, but a
  // seal is only ever READ through a descriptor — `snapshotFor` does `descriptors.find(...)` then
  // `persistedSeals[d.conceptText.trim()]` — and descriptors derive purely from rendered CARD
  // BLOCKS (`buildAmbientDescriptors`). So a stimulus the creator brought through the ＋ door had
  // no block, therefore no descriptor, therefore an ORPHANED seal: a measured verdict that
  // rendered nowhere. The block below IS the row.
  //
  // Its `stimulus` is the same `text` the seal is keyed by — that identity is the link, and the
  // descriptor guard test asserts it rather than trusting it.
  //
  // Ordered BEFORE the seal write on purpose. Both writes are non-fatal, so one can land without
  // the other, and the two failure directions are not equal: a card with no seal is an honest
  // QUEUED row (the state every un-simulated card is in), while a seal with no card is the orphan
  // this section exists to prevent. So the card goes first.
  //
  // No `run-header` block rides with it. That stamp's `skill` is the DISPLAY namespace
  // (ChatTurnKind / SKILL_RUN_META), and a brought stimulus is not any of those skills — inventing
  // an id there is the exact cast that shipped F-017. Without a stamp `classifyTurn` reads the turn
  // as plain, which renders the card alone: correct, since the card carries the whole run.
  if (wantCard) {
    try {
      await insertMessage(
        openThread.id,
        "assistant",
        [
          {
            type: "brought-card",
            props: {
              stimulus: text,
              kind: cardKind ?? "draft",
              lens,
              band,
              fraction,
              scrollQuote,
              model: "sim1-flash",
              ...(scene ? { scene } : {}),
              // The slice rides along whether or not it could be answered — an un-honoured slice
              // is a question the run did not answer, and the card says so rather than letting the
              // room's fraction pass for it.
              ...(slice
                ? {
                    slice: {
                      archetype: slice.archetype,
                      label: segmentLabel ?? slice.archetype,
                      honored: slice.honored,
                      ...(slice.stopPct !== undefined ? { stopPct: slice.stopPct } : {}),
                      ...(slice.total !== undefined ? { total: slice.total } : {}),
                      ...(slice.reason ? { reason: slice.reason } : {}),
                    },
                  }
                : {}),
              personas,
              ...(population ? { population } : {}),
            },
          },
        ],
        kcStamp().kcGenVersion,
      );
    } catch {
      // Non-fatal, like every other write on this route: the reaction is already computed and the
      // creator paid for it, so a failed insert must still return the verdict. The row is then
      // missing rather than wrong, and the seal below is what a retry would re-link to.
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
  //
  // ⚠️ A SLICED run seals the SLICE's verdict, not the room's. The two are different questions
  // ("does this land?" vs "does this land with Builders?") and the board shows them in one ranked
  // column, so the seal also records WHICH slice — the row prints that label beside the %, which
  // is what stops a 41%-of-Builders reading as 41%-of-the-room. A slice that could not be honoured
  // seals NOTHING: there is no verdict to record, and the room's number is not a stand-in for it.
  if (wantPersist) {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction);
    const roomPct =
      m && Number(m[2]) > 0
        ? Math.max(0, Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100)))
        : null;
    const pct = slice ? (slice.honored ? slice.stopPct! : null) : roomPct;
    if (pct !== null) {
      await writeSimSeal(supabase, openThread, text, {
        pct,
        // The band describes the 10-persona ROOM read; it does not describe a slice, so a sliced
        // seal carries none rather than borrowing one that was measured on a different population.
        band: slice ? null : band ?? null,
        at: new Date().toISOString(),
        population,
        personas,
        scrollQuote,
        ...(slice?.honored ? { slice: { archetype: slice.archetype, total: slice.total! } } : {}),
      });
    }
  }

  // ── (8) Return the reaction (NO persistence — type-to-room is ephemeral) ───
  // Also return the full per-persona reactions (real registry-enum archetypes) so the
  // ambient Room shows the NAMED People cast + the "Ask them why →" chat for a typed
  // thought — same as a generated card's own S3′ personas (The Room, Task B). Shape is
  // { archetype, verdict, quote } (FlashPersona) — the exact AmbientPersonaReaction shape.
  // `population` is the Stage 2 projection (null when the audience lacks v2 axes).
  // `slice` is present only when a segment was ASKED for: `honored` runs carry that slice's own
  // stopPct + headcount (what the client shows instead of the room's fraction), and un-honoured
  // ones carry the reason, so the client can say why rather than showing the room's number under
  // the slice's name. Null ⇒ a whole-room run, and the response is what it has always been.
  //
  // BILL — on delivery only. The reaction is computed and about to be returned; the two
  // failure paths above (a Flash throw → 502, a refused admission → 402) both leave before
  // here, so nothing that reaches this line can be un-delivered. A run whose SLICE could not
  // be honoured still bills: the room read ran, the engine was paid for, and the response
  // carries the real personas + population — the slice is one field of it, not the product.
  await billUsage({ userId: user.id, action: "react", tier: creditVerdict.tier });
  return Response.json({ fraction, scrollQuote, personas, population, slice });
}
