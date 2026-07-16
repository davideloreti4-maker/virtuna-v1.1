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
 *   event: meta  { coldStart: boolean }  — structured cold-start signal (D-08); emitted FIRST
 *   event: token { delta: string }       — per-token text chunk
 *   event: done  { }                     — stream complete
 *   event: error { message: string }     — on any pipeline throw
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy, getOpenThread, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage, loadMessages } from "@/lib/threads/messages";
import { runChatPipeline, isColdStart } from "@/lib/tools/runners/chat-runner";
import { runSkillDispatch } from "@/lib/tools/skill-dispatch";
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
  return process.env.CHAT_AGENT_DISPATCH === "true";
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

/**
 * Max prior turns to carry as context anchor.
 * D-01a soft context cap: full running context is the default; this bounds the
 * anchor size to avoid excessive token spend on very long threads.
 */
const MAX_PRIOR_TURNS = 20;

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
  let body: { ask?: unknown; platform?: unknown; personaGrounding?: unknown; priorTurns?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body — will fail ask validation below
  }

  const rawAsk = typeof body.ask === "string" ? body.ask.trim() : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";

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
  const activeAudience = openThread ? await resolveThreadAudience(supabase, openThread) : null;

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
    : // WR-05 INVARIANT: the open-chat anchor assumes EXACTLY ONE `markdown` block per message
      // row. Role is attributed from `msg.role` (per-message), so a conversational "turn" === a
      // message; the `.slice(-MAX_PRIOR_TURNS)` cap below counts blocks, which equals turns ONLY
      // while this invariant holds (open-chat persistence writes a single markdown block per turn
      // — see the POST persistence path: one `{ type: "markdown" }` block per insertMessage). If
      // multi-block markdown messages are ever introduced, attribute role per BLOCK (carry it on
      // the block) before relying on this anchor — otherwise the cap miscounts and every block in
      // a message inherits the parent message role.
      hydratedMessages
        .flatMap((msg) =>
          msg.blocks
            .filter(
              (b): b is { type: "markdown"; props: { text: string } } =>
                b.type === "markdown" && typeof (b as { props: { text?: unknown } }).props.text === "string",
            )
            .map((b) => ({
              role: msg.role as "user" | "assistant",
              text: (b as { type: "markdown"; props: { text: string } }).props.text,
            })),
        )
        .slice(-MAX_PRIOR_TURNS);

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

        // ── (8a) Chat-as-agent dispatch (default-off flag) ──────────────────────
        // Open chat only (persona/meet excluded). The model may run a content skill whose
        // real card-blocks are streamed (event: block) + persisted into THIS thread, then a
        // short co-pilot line closes the turn. If it runs NO skill, `dispatched` stays false
        // and control falls through to the grounded runChatPipeline below (unchanged answer).
        let dispatched = false;
        if (isChatAgentDispatchEnabled() && personaGrounding == null) {
          const dispatch = await runSkillDispatch({
            ask: rawAsk,
            context: {
              platform,
              profileRow,
              audience: activeAudience,
              // Real pipeline phase boundaries → the client's progress spine (mirrors skill routes).
              onStage: (name, status) => send("stage", { name, status }),
            },
            priorTurns,
          });

          if (dispatch.skillRuns.length > 0) {
            dispatched = true;
            // Stream + persist each skill's card-blocks. `block` events render inline via the
            // thread's MessageBlocks (every card type already has a renderer); insertMessage
            // re-validates each block at the write boundary (D-14) so a reload rehydrates them.
            for (const run of dispatch.skillRuns) {
              for (const block of run.blocks) send("block", { block });
              if (openThread && run.blocks.length > 0) {
                await insertMessage(openThread.id, "assistant", run.blocks, kcStamp().kcGenVersion);
              }
            }
            // Closing co-pilot line (points at the cards + a next step). We have it all at once,
            // so it rides a single token frame (the client accumulates tokens into markdown) and
            // persists as its own markdown message — the existing follow-up-turn shape.
            const closing = dispatch.text.trim();
            if (closing) {
              send("token", { delta: closing });
              if (openThread) {
                await insertMessage(
                  openThread.id,
                  "assistant",
                  [{ type: "markdown", props: { text: closing } }],
                  kcStamp().kcGenVersion,
                );
              }
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
