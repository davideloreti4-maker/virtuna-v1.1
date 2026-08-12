/**
 * /api/tools/chat — Open-chat SSE route (Plan 05-01, Task 2).
 *
 * POST — authenticate, load profile (cold-start safe), get/create the user's
 *         open thread, persist the user turn, stream a profile-grounded Qwen
 *         markdown answer token-by-token, persist the assistant turn, and emit
 *         a structured `coldStart` meta frame so Plan 05-03 can gate the
 *         one-time nudge UI (D-08).
 *
 * THREAD-03 / D-07/D-08:
 *   - Grounded via assembleBundle({mode:"chat"}) + KC_CHAT_SYSTEM_PROMPT (inside runner).
 *   - Cold-start degrades to platform baselines (open chat still works, D-08).
 *   - Persists both turns as `markdown` blocks in the single open thread (type:"open").
 *
 * Security (mirrors hooks/ideas route posture):
 *   - Auth enforced before any DB read (user_id from session only, never body)
 *   - Server-side ask length cap (independent of client)
 *   - Platform normalised to allowed enum
 *   - insertMessage re-validates blocks at write boundary (D-14)
 *   - Qwen-only (getQwenClient / QWEN_REASONING_MODEL — inside chat-runner)
 *   - Rate-limit deferred to v2 (auth + ask-cap are v1 boundary)
 *
 * SSE STREAM:
 *   event: dispatch { skill: string }   — the agent committed to a skill run (display key)
 *   event: meta  { coldStart: boolean }  — structured cold-start signal (D-08); emitted FIRST
 *   event: token { delta: string }       — per-token text chunk
 *   event: done  { }                     — stream complete
 *   event: error { message: string }     — on any pipeline throw
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy, getOpenThread, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage, loadMessages } from "@/lib/threads/messages";
import { runHeaderBlock } from "@/lib/tools/run-header";
import { openChatPriorTurns, MAX_PRIOR_TURNS } from "@/lib/threads/chat-prior-turns";
import { runChatPipeline, isColdStart } from "@/lib/tools/runners/chat-runner";
import { runChatAgentStream, sanitizeCards, type SkillBilling } from "@/lib/tools/chat-agent-loop";
import { FREE_SKILL_TOOLS } from "@/lib/tools/skill-dispatch";
import { guessSkill } from "@/lib/tools/pre-router";
import { detectRepeatAsk, isRepeatAskPinEnabled } from "@/lib/tools/repeat-ask";
import { detectGuessPin, isGuessPinEnabled } from "@/lib/tools/guess-pin";
import { billUsage, creditGate, quotaRefusalBody, quotaRefusalMessage } from "@/lib/billing/credit-gate";
import { creditCost, type BillableAction } from "@/lib/pricing";
import type { QuotaUser } from "@/lib/billing/quota";
import type { NumenTier } from "@/lib/whop/config";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { assembleBundle } from "@/lib/kc/assembler";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/** Server-side persona-grounding shape — mirrors ChatPipelineInput.personaGrounding. */
type PersonaGrounding = {
  archetype: Archetype;
  /** Present = post-reaction "Ask them why →"; ABSENT = meet-mode introduction (idle room, no concept yet). */
  reactionToConcept?: { verdict: "stop" | "scroll"; quote: string };
  /** Required alongside reactionToConcept; never present in meet-mode. */
  conceptText?: string;
  /** The persona's real display name (The Room, Task A) — server-capped, optional. */
  personaName?: string;
};

/** Server-side cap on the persona concept/quote anchors (WARNING-5 — no new boundary). */
const PERSONA_TEXT_CAP = 2000;

/** Tight cap on the persona name (a first-name label, not free text) — trims + bounds it. */
const PERSONA_NAME_CAP = 60;

/**
 * Validate + length-cap the optional personaGrounding from the request body. Returns null
 * when absent or malformed (the route then runs the byte-identical open-chat path). archetype
 * MUST be a known registry enum; verdict MUST be stop|scroll; concept/quote are capped.
 */
function parsePersonaGrounding(raw: unknown): PersonaGrounding | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const archetype = g.archetype;
  if (typeof archetype !== "string" || !ARCHETYPES.includes(archetype as Archetype)) return null;
  // Optional persona name (The Room, Task A) — trim + cap. Absent/blank → omitted, and the runner
  // degrades to the byte-identical archetype-only prompt.
  const rawName = typeof g.personaName === "string" ? g.personaName.trim().slice(0, PERSONA_NAME_CAP) : "";
  const named = rawName.length > 0 ? { personaName: rawName } : {};
  const reaction = g.reactionToConcept;
  if (reaction == null) {
    // MEET-MODE (idle "Meet your room" chat): no reaction, no concept — the persona introduces
    // itself in-voice. conceptText is deliberately DROPPED so an unanchored concept can never
    // reach the runner outside a reaction.
    return { archetype: archetype as Archetype, ...named };
  }
  if (typeof reaction !== "object") return null;
  const r = reaction as Record<string, unknown>;
  const verdict = r.verdict;
  if (verdict !== "stop" && verdict !== "scroll") return null;
  const quote = typeof r.quote === "string" ? r.quote.slice(0, PERSONA_TEXT_CAP) : "";
  const conceptText = typeof g.conceptText === "string" ? g.conceptText.slice(0, PERSONA_TEXT_CAP) : "";
  if (conceptText.length === 0) return null;
  return {
    archetype: archetype as Archetype,
    reactionToConcept: { verdict, quote },
    conceptText,
    ...named,
  };
}

/**
 * The gate + till the chat agent charges a dispatched skill through.
 *
 * Deliberately a thin wrapper over the SAME `creditGate` / `billUsage` / `quotaRefusalMessage` the
 * dedicated skill routes call: the price, the admission rules and the refusal wording all have one
 * implementation, so "ask the agent for hooks" and "press the Hooks skill" can never quietly become
 * two different products. The only difference is the SHAPE of a refusal — a route returns a 402, but
 * a turn that is already streaming cannot, so the honest sentence goes back as a tool result for the
 * model to relay (chat-agent-loop.ts hands it over with an instruction not to fake the result).
 */
function skillBilling(supabase: Awaited<ReturnType<typeof createClient>>, user: QuotaUser): SkillBilling {
  return {
    gate: async (action: BillableAction) => {
      const { refusal, verdict } = await creditGate(supabase, user, action);
      if (refusal) {
        const cost = creditCost(action);
        return {
          allowed: false,
          reason: quotaRefusalMessage(verdict, cost),
          tier: verdict.tier,
          // The same body the 402 carries, so the client can raise the SAME wall dialog. Rebuilt
          // rather than read off `refusal` (a Response whose body is a stream we would consume).
          quota: quotaRefusalBody(verdict, cost),
        };
      }
      return { allowed: true, tier: verdict.tier };
    },
    // Best-effort by contract (billUsage swallows + logs its own failures) — a delivered pack of
    // cards outranks our accounting, exactly as on every other route.
    bill: async (action: BillableAction, tier?: NumenTier | null) => {
      await billUsage({ userId: user.id, action, tier });
    },
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Server-side ask cap — independent of client validation (mirrors analyze/[id]/chat). */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Chat-as-agent dispatch flag (default OFF). When on, an OPEN-chat turn is first handed to the
 * skill-dispatch model (skill-dispatch.ts): if the creator asked for content it can name, the model
 * runs that skill (generate_ideas / generate_hooks / write_script) and its real card-blocks land in
 * THIS thread like any other message — no manual skill selector. Paid runs are leashed inside
 * runSkillDispatch. When the model runs NO skill (pure chat / strategy talk), the route falls back to
 * the existing grounded runChatPipeline, so the plain-chat answer is never degraded.
 *
 * Persona / meet-mode is EXCLUDED (a viewer reacts in-voice; it does not orchestrate skills) — mirrors
 * the corpus-tool exclusion. Flag OFF → byte-identical to the shipped open-chat + persona paths.
 */
function isChatAgentDispatchEnabled(): boolean {
  // Default ON (shipped 2026-07-17). Set CHAT_AGENT_DISPATCH="false" to disable.
  return process.env.CHAT_AGENT_DISPATCH !== "false";
}

/**
 * Grounding-as-a-tool flag (default OFF, independent lever). When on, the streaming agent loop binds
 * the corpus `search_corpus` tool so the model can pull real proven examples mid-answer. Mirrors the
 * `GROUNDING_CHAT_TOOL` gate `runChatPipeline` used for its (now-replaced) corpus pre-flight.
 */
function isCorpusChatToolEnabled(): boolean {
  // Default ON (shipped 2026-07-17). Set GROUNDING_CHAT_TOOL="false" to disable.
  return process.env.GROUNDING_CHAT_TOOL !== "false";
}

/**
 * Stage B "one brain" flag (default OFF — ships dark, lane convention). ONE lever for the stage:
 * B1 (card CTAs through this route with a pinned skill + a data-carried anchor), B2 (the `cards`
 * slot on the generator schemas + chip-carried packs), B3 (the `predispatch` frame). NEXT_PUBLIC_
 * on purpose: the client half (CTA routing in composer.tsx) reads the same variable, inlined at
 * build time — so flipping it in an env needs a REDEPLOY to reach the client, which env changes
 * need here anyway (memory: env vars are write-only + need a redeploy).
 */
function isOneBrainEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENGINE_ONE_BRAIN === "true";
}

/** Cap on client-carried prior turns (meet-mode ephemeral context — see POST). */
const MAX_CLIENT_PRIOR_TURNS = 20;

/**
 * Validate + cap the CLIENT-carried prior turns. Honored ONLY in meet-mode when no thread
 * exists (the ephemeral path): it is the same data the DB path would supply, just carried by
 * the drawer because there is no row to read. Rides assembleBundle's fenced anchor exactly
 * like DB turns — never raw into the system prompt.
 */
function parseClientPriorTurns(raw: unknown): Array<{ role: "user" | "assistant"; text: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const t of raw.slice(-MAX_CLIENT_PRIOR_TURNS)) {
    if (!t || typeof t !== "object") continue;
    const role = (t as Record<string, unknown>).role;
    const text = (t as Record<string, unknown>).text;
    if ((role === "user" || role === "assistant") && typeof text === "string" && text.length > 0) {
      out.push({ role, text: text.slice(0, MAX_MESSAGE_LENGTH) });
    }
  }
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── GET /api/tools/chat?archetype=… ─────────────────────────────────────────────
// Sub-thread rehydration (P9 / D-03): returns the prior persona-chat-turn turns for
// the given archetype in the user's open thread, so the drawer re-appears on reopen.
// Auth-gated; archetype validated against the registry enum. No body, read-only.

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const archetype = url.searchParams.get("archetype");
  if (!archetype || !ARCHETYPES.includes(archetype as Archetype)) {
    return Response.json({ error: "valid archetype is required" }, { status: 400 });
  }

  // READ-ONLY: never create a thread from a GET. Under the NEW_THREAD_SENTINEL pointer
  // getOpenThread returns null (no row exists yet) — rehydration is simply empty. The old
  // createOpenThreadLazy here minted a fresh open thread on EVERY drawer open (verified live:
  // four spam rows in four minutes), scattering sub-threads across them.
  const openThread = await getOpenThread(user.id);
  if (!openThread) return Response.json({ turns: [] });
  const hydratedMessages = await loadMessages(openThread.id);
  const turns = hydratedMessages.flatMap((msg) =>
    msg.blocks
      .filter(
        (b): b is { type: "persona-chat-turn"; props: { archetype: string; role: "user" | "assistant"; text: string } } =>
          b.type === "persona-chat-turn" &&
          (b as { props: { archetype?: unknown } }).props.archetype === archetype,
      )
      .map((b) => ({
        role: (b as { props: { role: "user" | "assistant" } }).props.role,
        text: (b as { props: { text: string } }).props.text,
      })),
  );

  return Response.json({ turns });
}

// ── POST /api/tools/chat ──────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate — before any DB read ───────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("chat", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "chat");
  if (limited) return limited;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: {
    ask?: unknown;
    platform?: unknown;
    personaGrounding?: unknown;
    priorTurns?: unknown;
    skill?: unknown;
    anchor?: unknown;
    cards?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body — will fail ask validation below
  }

  const rawAsk = typeof body.ask === "string" ? body.ask.trim() : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";

  // ── (2c) The generator a tapped follow-up chip declared (chat-followups.ts `skill`) ──
  // A chip is a command the creator issued under cards that already fix the subject; its sentence
  // reads as subject-less on its own, so the agent used to push back for a sharper angle and run
  // nothing. The chip's intent therefore rides as DATA and pins the loop's first tool_choice.
  //
  // Passed through as an opaque key, NOT trusted: the loop resolves it against the skills actually
  // bound for THIS user and ignores anything it cannot match — so a hand-crafted body naming a paid
  // skill buys an anonymous visitor nothing (they bind none), and a signed-in caller gets the same
  // gate, price and ledger row that typing the ask would have. A typed message never sets it, which
  // is what keeps ordinary conversational asks byte-identical.
  const rawSkill = typeof body.skill === "string" ? body.skill.slice(0, 32) : undefined;

  // ── (2d) Stage B data riders — honored ONLY beside a declared skill, flag on ──
  // `anchor` is the exact line a card CTA was pressed on (B1); `cards` is the pack a tapped
  // chip refers to (B2). Both are DATA the client can see and the model would otherwise have
  // to reconstruct; both are server-capped here (mirroring the dedicated routes' anchor cap)
  // and injected by the loop into the round-1 pinned call only. Without `skill` there is no
  // pinned call to inject into, so they are dropped — a hand-crafted body gains nothing.
  const ONE_BRAIN = isOneBrainEnabled();
  const rawAnchor =
    ONE_BRAIN && rawSkill && typeof body.anchor === "string"
      ? body.anchor.slice(0, 5000)
      : undefined;
  const rawCards = ONE_BRAIN && rawSkill ? sanitizeCards(body.cards) : undefined;

  // ── (2b) Parse optional personaGrounding (P9 / LIVE-03, D-03) ────────────────
  // The "Ask them why →" chat-with-persona drawer POSTs this. Validated + length-capped
  // server-side (WARNING-5 — independent of the client). archetype must be a known enum.
  const personaGrounding = parsePersonaGrounding(body.personaGrounding);

  if (rawAsk.length === 0) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (rawAsk.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `ask must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  // Normalise platform to allowed enum (default tiktok)
  const platform = (
    ["tiktok", "instagram", "youtube"].includes(rawPlatform) ? rawPlatform : "tiktok"
  ) as "tiktok" | "instagram" | "youtube";

  // ── (3) Load creator profile (cold-start safe — D-08) ────────────────────
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (4) Cold-start signal computed route-side (D-08) ─────────────────────
  // isColdStart is exported from the runner and mirrors assembler.ts isProfileThin.
  // Computing it here (before the stream starts) allows the meta frame to LEAD the stream.
  const coldStart = isColdStart(profileRow);

  // ── (5) Resolve the open thread ───────────────────────────────────────────
  // MEET-MODE (persona grounding without a reaction) never CREATES a thread: under the
  // NEW_THREAD_SENTINEL pointer createOpenThreadLazy minted a fresh row per call (verified
  // live), and a "say hi" introduction is not a reason to spawn a thread. If a real thread
  // is already open the meet turns join its per-archetype sub-thread (continuity with the
  // later "Ask them why" chat); with no thread the chat runs EPHEMERAL (no persistence).
  const isMeet = personaGrounding != null && personaGrounding.reactionToConcept == null;
  const openThread = isMeet ? await getOpenThread(user.id) : await createOpenThreadLazy(user.id);

  // ── (5a) Load active audience (08-04 / D-04 per-thread pin — shared helper) ──
  // thread.active_audience_id: NULL = General default; non-null = load under the session.
  // Falls back to General on a missing id or a load failure (non-fatal). Id is NEVER from
  // the request body — session/thread only (CR-01). No thread (meet-ephemeral) → General.
  const activeAudience = openThread ? await resolveThreadAudience(supabase, openThread, user.id) : null;

  // ── (6) Load prior turns for context anchor (D-01 full running context, D-01a soft cap) ──
  // Open chat → prior `markdown` turns. Persona-grounded chat (P9 / D-03) → prior
  // `persona-chat-turn` turns SCOPED to this archetype (the sub-thread). Either way the
  // running context rides assembleBundle's fenced anchor.
  const hydratedMessages = openThread ? await loadMessages(openThread.id) : [];
  const priorTurns = personaGrounding
    ? openThread
      ? hydratedMessages
          .flatMap((msg) =>
            msg.blocks
              .filter(
                (b): b is { type: "persona-chat-turn"; props: { archetype: string; role: "user" | "assistant"; text: string } } =>
                  b.type === "persona-chat-turn" &&
                  (b as { props: { archetype?: unknown } }).props.archetype === personaGrounding.archetype,
              )
              .map((b) => ({
                role: (b as { props: { role: "user" | "assistant" } }).props.role,
                text: (b as { props: { text: string } }).props.text,
              })),
          )
          .slice(-MAX_PRIOR_TURNS)
      : // Meet-ephemeral (no thread): the drawer carries its own in-session transcript so the
        // persona keeps context across turns — validated + capped, same fenced anchor as DB turns.
        parseClientPriorTurns(body.priorTurns)
    : // Open chat — markdown turns, each dispatching turn carrying the runs it announced (see
      // openChatPriorTurns for why the runs travel with it).
      openChatPriorTurns(hydratedMessages);

  // ── (7) Persist the USER turn first (mirrors grounded-chat route ordering) ──
  // Persona-grounded → persist as a `persona-chat-turn` block (the sub-thread, D-03);
  // open chat → the existing `markdown` block. Both round-trip loadMessages validation.
  // Meet-ephemeral (no thread) → nothing to persist.
  if (openThread) {
    const userBlock = personaGrounding
      ? { type: "persona-chat-turn", props: { archetype: personaGrounding.archetype, role: "user", text: rawAsk } }
      : { type: "markdown", props: { text: rawAsk } };
    await insertMessage(openThread.id, "user", [userBlock], kcStamp().kcGenVersion);
    // First typed question titles the thread (write-once; best-effort).
    await setThreadTitleIfEmpty(user.id, openThread.id, rawAsk);
  }

  // ── (8) SSE stream: emit meta → run pipeline → emit tokens → persist assistant turn ──
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
        // meta frame LEADS the stream — Plan 05-03 gates the one-time nudge on this (D-08)
        send("meta", { coldStart });

        // ── (8a) Chat-as-agent — single STREAMING agent loop (default-off flag) ──
        // Open chat only (persona/meet excluded — a viewer reacts in-voice, it does not orchestrate).
        // ONE streaming completion: the model streams its answer directly (token frames) and pauses only
        // to call a tool — a content skill (its cards stream as `block` events) or `search_corpus`
        // (grounding). No pre-flight, no discarded answer (the old runSkillDispatch + runChatPipeline
        // double-call). Flag OFF or persona → the unchanged runChatPipeline path below.
        let dispatched = false;
        if (isChatAgentDispatchEnabled() && personaGrounding == null) {
          dispatched = true;

          // ── (8a-0) Stage B (B3): the predispatch frame — fills the router's ~4.8s dead zone ──
          // Emitted BEFORE the loop starts, from what is already known:
          //   · a declared skill (chip/CTA) is CERTAIN — the creator pressed it and round 1 is
          //     pinned to it, so the client seeds the full capsule immediately;
          //   · a typed ask gets the cheap heuristic guess, streamed as a HINT (certain:false) the
          //     client renders next to the thinking dots — the real `dispatch` frame, which still
          //     fires only after the gate admits the run, confirms or replaces it.
          // Sealed visitors bind no generators, so neither claim would be honest — no frame.
          if (ONE_BRAIN && !isSealedVisitor(user)) {
            if (rawSkill && ["ideas", "hooks", "script"].includes(rawSkill)) {
              send("predispatch", { skill: rawSkill, certain: true });
            } else if (!rawSkill) {
              const guess = guessSkill(rawAsk);
              if (guess) send("predispatch", { skill: guess, certain: false });
            }
          }
          // ── (8a-0b) THE REPEAT-ASK PIN (2026-08-10, flagged OFF) ──────────────────────────
          // Only for a TYPED ask — a chip already declares its own skill and wins below. See
          // repeat-ask.ts for why the trigger is three conditions rather than the obvious two:
          // the pre-router's single measured harmful guess ("Yes, run the simulate tool on that
          // hook") lives in a thread that necessarily HAS a prior hooks run, so "guessed + ran it
          // before" would have turned the one known false alarm into a forced billed wrong run.
          const repeatAskSkill =
            isRepeatAskPinEnabled() && !rawSkill && !isSealedVisitor(user)
              ? detectRepeatAsk(rawAsk, priorTurns)
              : null;

          // ── (8a-0c) THE GUESS PIN (2026-08-12, flagged OFF) ───────────────────────────────
          // The broader structural fix for the same family of defect, measured over 183 real
          // generations: a product- or format-shaped SUBJECT dispatches 7/31 (23%) against 30/30
          // for a scenario subject. Same scoping as the repeat-ask pin above (typed asks only,
          // never a sealed visitor), and strictly broader than it — every repeat ask is also a
          // guess fire — so the two compose by subsumption rather than by precedence. See
          // guess-pin.ts for why the trigger is the guess and not the observed non-dispatch.
          const guessPinSkill =
            isGuessPinEnabled() && !rawSkill && !isSealedVisitor(user) ? detectGuessPin(rawAsk) : null;

          // Grounding (niche/audience/platform) rides the fenced user message, exactly as
          // runChatPipeline builds it (assembleBundle → <<<USER_CONTENT>>>). Prior turns go to the loop
          // as real role messages (natural turn structure for the agent), not folded into the anchor.
          //
          // modeLabel — NOT cosmetic. The bundle header lands in the USER message, and the bare word
          // "chat" reads to the model as the chat slice's own stance ("chat mode is conversational,
          // NOT a generation surface", with over-generating named as a failure mode). That sentence is
          // right for the pure-chat path below and exactly wrong here, where the generators are bound
          // and the loop's directive says to dispatch eagerly: the model read the label, obeyed it, and
          // answered "give me hooks for X" in prose while holding generate_hooks unused. Measured on the
          // shipped prompts, 4 seeds: 0/4 dispatches with "chat", 4/4 with any other label. `mode` stays
          // "chat" — it is the MODE_ROLES selector, so the grounding content is unchanged.
          const userMessage = assembleBundle(
            { ask: rawAsk, platform, mode: "chat", modeLabel: "copilot" },
            profileRow,
          );
          const agentResult = await runChatAgentStream(
            {
              ask: userMessage,
              systemPrompt: KC_CHAT_SYSTEM_PROMPT,
              priorTurns,
              // The creator's own words this turn, for the conversation digest ONLY. `priorTurns`
              // is loaded at (6) and this message is persisted at (7), so the digest handed to a
              // generator was missing the turn being answered — "…but keep them under 30s" never
              // reached it, and on a thread's first generating turn the digest was empty. `ask`
              // above cannot serve: it is the assembled bundle, not the message.
              currentAsk: rawAsk,
              // The tapped chip's declared generator (see (2c)); undefined for every typed message.
              // …OR, failing that, a REPEAT ASK: the creator typing a request this thread has
              // already run, which is the shape that makes the model claim work it did not do
              // ("Here are 5 hooks for 'morning focus'…" with no dispatch and no cards, measured
              // live). `forceSkill` is the right seam because it is already exactly this — a
              // round-1 tool_choice pin, gated and billed like any other run — and because the
              // fix has to be structural: the directive already forbids the claim in the
              // strongest words available and is ignored, since the transcript showing the pack
              // is stronger precedent than any instruction. Never overrides a real chip.
              ...(rawSkill
                ? { forceSkill: rawSkill }
                : repeatAskSkill
                  ? { forceSkill: repeatAskSkill }
                  : guessPinSkill
                    ? { forceSkill: guessPinSkill }
                    : {}),
              // Stage B data riders (see (2d)) — round-1 pinned call only, inside the loop.
              ...(rawAnchor ? { forceAnchor: rawAnchor } : {}),
              ...(rawCards ? { forceCards: rawCards } : {}),
              // Stage B (B2): bind the `cards` slot on the generator schemas (flag-gated).
              cardsSlot: ONE_BRAIN,
              grounding: isCorpusChatToolEnabled(),
              context: {
                platform,
                profileRow,
                audience: activeAudience,
                // Real skill phase boundaries → the client's progress spine (mirrors skill routes).
                onStage: (name, status) => send("stage", { name, status }),
                // …and the artifacts those phases touched. An agent-dispatched hooks run IS the
                // hooks pipeline, so its wait shows the same proven outliers the skill route's does.
                onEvidence: (evidence) => send("evidence", evidence),
              },
              onToken: (delta) => send("token", { delta }),
              onBlock: (block) => send("block", { block }),
              // The run-capsule seam: the moment the agent commits to a skill, tell the client WHICH
              // (display key), so the spine labels itself + seeds that skill's stage plan before the
              // first stage event. One frame, additive — old clients simply ignore the event.
              onDispatch: (skill) => send("dispatch", { skill }),
              // A streaming turn cannot answer 402, so the refusal body rides its own frame and the
              // client raises the same paywall dialog every other refused skill raises.
              onCreditWall: (quota) => send("credit-wall", { quota }),
            },
            {
              // THE TRIAL WALL, on chat's back door. This route is free BY DECISION (the glue of the
              // product) — but the skills the agent can dispatch are not: ideas, hooks and scripts are
              // metered actions with their own creditGate and their own 402. An anonymous /go visitor is
              // entitled to ONE free Test and nothing else, so the paid tools are not even BOUND for
              // them: the agent answers in words instead of running an engine. Filtering the registry is
              // the whole fix because `deps.skills` drives both what the model is offered and what the
              // loop will execute.
              ...(isSealedVisitor(user) ? { skills: FREE_SKILL_TOOLS } : {}),
              // The SAME fact, stated to the loop rather than left to be inferred from the line
              // above. The artefact guard used to arm itself from "no generators are bound", which
              // is only true while FREE_SKILL_TOOLS happens to be empty — and it is DERIVED from
              // `billable`, so one non-billable skill (exactly what a free tier is) would flip it
              // non-empty and silently switch the guard off for every anonymous visitor. Binding
              // and guarding now read the same predicate, on adjacent lines, so they cannot drift.
              sealedVisitor: isSealedVisitor(user),
              // THE TILL, for everyone else. Until this was wired the sentence above ended "…an engine
              // this route would neither gate nor bill" — and that was literally true for every signed-in
              // customer too: an agent-dispatched ideas/hooks/script run hit the paid engine with no
              // admission check and left no ledger row, while the identical pack cost credits when run
              // from the skill pill. Same price, same helpers, same refusal copy as the dedicated routes,
              // so the two doors into the engine cannot drift apart.
              billing: skillBilling(supabase, user),
            }
          );

          // The runners' REAL warnings (Stage A) — the loop used to hardcode `[]`, so a
          // degraded chat-dispatched run (grounding failed, a card dropped, an anchor not
          // honored) was indistinguishable from a clean one. Same SSE event the dedicated
          // routes emit; live-only, like theirs.
          const runWarnings = agentResult.skillRuns.flatMap((run) => run.warnings);
          if (runWarnings.length > 0) {
            send("warning", { warnings: runWarnings });
          }

          // Persist: each skill's card-blocks first (in run order), then the assistant text. A turn that
          // ran a skill marks the text origin:"chat-agent" so the thread reloads as ONE ordered stream in
          // the chat view (rehydrate-thread.ts); a pure-chat turn persists plain markdown → byte-identical
          // to the old open-chat reload. insertMessage re-validates every block at the write boundary (D-14).
          if (openThread) {
            for (const run of agentResult.skillRuns) {
              if (run.blocks.length > 0) {
                // Stage A (F-3): stamp the run like every dedicated skill route does. The
                // chat door was the one unstamped path — a reloaded turn lost its skill +
                // audience and the intro fell back to the renderer's literal 'General'.
                const stamped = run.skillKey
                  ? [
                      runHeaderBlock({
                        skill: run.skillKey,
                        audienceLabel: activeAudience?.name,
                        platform,
                      }),
                      ...run.blocks,
                    ]
                  : run.blocks;
                await insertMessage(openThread.id, "assistant", stamped, kcStamp().kcGenVersion);
              }
            }
            // UI affordance blocks (an input-request field from request_link) — persisted so the field
            // survives the post-turn reload; without this it would render live then vanish (D-14 revalidates).
            if (agentResult.uiBlocks.length > 0) {
              await insertMessage(openThread.id, "assistant", agentResult.uiBlocks, kcStamp().kcGenVersion);
            }
            const text = agentResult.text.trim();
            if (text.length > 0) {
              // origin:"chat-agent" makes the thread reload as ONE ordered stream in the chat view when
              // the turn produced any blocks (skill cards OR a field), not just skill cards.
              const producedBlocks = agentResult.skillRuns.length > 0 || agentResult.uiBlocks.length > 0;
              const props = producedBlocks ? { text, origin: "chat-agent" } : { text };
              await insertMessage(openThread.id, "assistant", [{ type: "markdown", props }], kcStamp().kcGenVersion);
            }
          }
        }

        // ── (8b) Grounded open-chat / persona answer (unchanged path) ───────────
        // Runs unless a skill was dispatched above. Tokens are emitted via callback as they
        // arrive; personaGrounding (when present) makes the answer in-voice (D-03).
        if (!dispatched) {
          const { fullContent } = await runChatPipeline(
            {
              ask: rawAsk,
              platform,
              profileRow,
              priorTurns,
              audience: activeAudience,
              ...(personaGrounding ? { personaGrounding } : {}),
            },
            (delta: string) => send("token", { delta }),
          );

          // Persist assistant turn — persona-chat-turn (sub-thread, D-03) or markdown (open chat).
          // Meet-ephemeral (no thread) → the streamed answer lives only in the drawer.
          if (openThread) {
            const assistantBlock = personaGrounding
              ? {
                  type: "persona-chat-turn",
                  props: { archetype: personaGrounding.archetype, role: "assistant", text: fullContent },
                }
              : { type: "markdown", props: { text: fullContent } };
            await insertMessage(openThread.id, "assistant", [assistantBlock], kcStamp().kcGenVersion);
          }
        }

        send("done", {});
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Chat stream failed",
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
