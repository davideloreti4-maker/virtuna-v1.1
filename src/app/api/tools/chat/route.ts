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
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage, loadMessages } from "@/lib/threads/messages";
import { runChatPipeline, isColdStart } from "@/lib/tools/runners/chat-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/** Server-side persona-grounding shape — mirrors ChatPipelineInput.personaGrounding. */
type PersonaGrounding = {
  archetype: Archetype;
  reactionToConcept: { verdict: "stop" | "scroll"; quote: string };
  conceptText: string;
};

/** Server-side cap on the persona concept/quote anchors (WARNING-5 — no new boundary). */
const PERSONA_TEXT_CAP = 2000;

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
  const reaction = g.reactionToConcept;
  if (!reaction || typeof reaction !== "object") return null;
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
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Server-side ask cap — independent of client validation (mirrors analyze/[id]/chat). */
const MAX_MESSAGE_LENGTH = 2000;

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

  const openThread = await createOpenThreadLazy(user.id);
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

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { ask?: unknown; platform?: unknown; personaGrounding?: unknown } = {};
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

  // ── (6) Load prior turns for context anchor (D-01 full running context, D-01a soft cap) ──
  // Open chat → prior `markdown` turns. Persona-grounded chat (P9 / D-03) → prior
  // `persona-chat-turn` turns SCOPED to this archetype (the sub-thread). Either way the
  // running context rides assembleBundle's fenced anchor.
  const hydratedMessages = await loadMessages(openThread.id);
  const priorTurns = personaGrounding
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
    : hydratedMessages
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
  const userBlock = personaGrounding
    ? { type: "persona-chat-turn", props: { archetype: personaGrounding.archetype, role: "user", text: rawAsk } }
    : { type: "markdown", props: { text: rawAsk } };
  await insertMessage(openThread.id, "user", [userBlock], kcStamp().kcGenVersion);

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

        // Run the pipeline — tokens are emitted via callback as they arrive.
        // personaGrounding (when present) makes the answer in-voice (D-03); absent → open chat.
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
        const assistantBlock = personaGrounding
          ? {
              type: "persona-chat-turn",
              props: { archetype: personaGrounding.archetype, role: "assistant", text: fullContent },
            }
          : { type: "markdown", props: { text: fullContent } };
        await insertMessage(openThread.id, "assistant", [assistantBlock], kcStamp().kcGenVersion);

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
