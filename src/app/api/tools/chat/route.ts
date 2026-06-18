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
import type { ProfileRow } from "@/lib/kc/profile-role-map";

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

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { ask?: unknown; platform?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Missing/malformed body — will fail ask validation below
  }

  const rawAsk = typeof body.ask === "string" ? body.ask.trim() : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";

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

  // ── (6) Load prior turns for context anchor (D-01 full running context, D-01a soft cap) ──
  const hydratedMessages = await loadMessages(openThread.id);
  const priorTurns = hydratedMessages
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
  await insertMessage(
    openThread.id,
    "user",
    [{ type: "markdown", props: { text: rawAsk } }],
    kcStamp().kcGenVersion,
  );

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

        // Run the pipeline — tokens are emitted via callback as they arrive
        const { fullContent } = await runChatPipeline(
          { ask: rawAsk, platform, profileRow, priorTurns },
          (delta: string) => send("token", { delta }),
        );

        // Persist assistant turn (markdown block)
        await insertMessage(
          openThread.id,
          "assistant",
          [{ type: "markdown", props: { text: fullContent } }],
          kcStamp().kcGenVersion,
        );

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
