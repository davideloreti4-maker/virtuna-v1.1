/**
 * /api/analyze/[id]/chat — "Ask the expert" streaming chat endpoint.
 *
 * GET  — return ordered conversation history for this analysis.
 * POST — stream a Qwen answer grounded on the cached analysis_results row.
 *
 * Security mitigations (T-00u-01 – T-00u-05):
 *   - Auth enforced before any DB read (T-00u-01)
 *   - analysis_id owned by authed user (IDOR 404, T-00u-01)
 *   - Message length cap + scope allowlist (T-00u-02, T-00u-03)
 *   - Per-analysis cap + per-user rate limit (T-00u-02)
 *   - user_id set server-side from session, never from body (T-00u-05)
 *   - Qwen/DashScope only — no Claude/Gemini/DeepSeek (T-00u-04)
 */

import { createClient } from "@/lib/supabase/server";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { buildChatSystemContext, VALID_SCOPES } from "@/lib/chat/seed-context";
import type { AnalysisRow, ChatScope } from "@/lib/chat/seed-context";

// ── Rate limit / cap constants (Claude's discretion) ─────────────────────
const PER_ANALYSIS_USER_CAP = 20;   // max user turns per single analysis
const RATE_LIMIT_WINDOW_SECS = 60;  // rolling window for per-user rate limit
const RATE_LIMIT_MAX_MSGS = 10;     // max messages per user in that window
const MAX_MESSAGE_LENGTH = 2000;    // chars — enforces T-00u-02 / T-00u-03

// ── Helpers ───────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ── GET /api/analyze/[id]/chat ─────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS enforces ownership; this query returns only rows the user owns.
  const { data, error } = await supabase
    .from("analysis_chats")
    .select("role, content, scope, created_at")
    .eq("analysis_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: "Failed to load conversation" }, { status: 500 });
  }

  return Response.json({ messages: data ?? [] });
}

// ── POST /api/analyze/[id]/chat ─────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Body validation ───────────────────────────────────────────────────
  let body: { message?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = body.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Scope allowlist (T-00u-03)
  const rawScope = body.scope;
  const scope: ChatScope =
    typeof rawScope === "string" && VALID_SCOPES.includes(rawScope)
      ? (rawScope as ChatScope)
      : null;

  // ── Load cached analysis row (T-00u-01 IDOR guard) ────────────────────
  const { data: analysisRow, error: analysisErr } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (analysisErr || !analysisRow) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  // ── Per-analysis message cap (T-00u-02) ────────────────────────────────
  const { count: userTurnCount, error: countErr } = await supabase
    .from("analysis_chats")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", id)
    .eq("user_id", user.id)
    .eq("role", "user");

  if (countErr) {
    return Response.json({ error: "Failed to check message cap" }, { status: 500 });
  }
  if ((userTurnCount ?? 0) >= PER_ANALYSIS_USER_CAP) {
    return Response.json(
      { error: `Message cap reached for this analysis (max ${PER_ANALYSIS_USER_CAP} messages).` },
      { status: 429 }
    );
  }

  // ── Per-user rate limit — rolling window (T-00u-02) ───────────────────
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SECS * 1000
  ).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("analysis_chats")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", windowStart);

  if (rateErr) {
    return Response.json({ error: "Failed to check rate limit" }, { status: 500 });
  }
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_MSGS) {
    return Response.json(
      { error: `Rate limit exceeded. Please wait before sending more messages.` },
      { status: 429 }
    );
  }

  // ── Build message history (prior turns + new user message) ───────────
  const { data: priorTurns } = await supabase
    .from("analysis_chats")
    .select("role, content")
    .eq("analysis_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const systemContext = buildChatSystemContext(analysisRow as AnalysisRow, scope);

  type OAIMessage = { role: "system" | "user" | "assistant"; content: string };
  const messages: OAIMessage[] = [
    { role: "system", content: systemContext },
    ...(priorTurns ?? []).map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content as string,
    })),
    { role: "user", content: message.trim() },
  ];

  // ── Persist the user turn BEFORE streaming ────────────────────────────
  const { error: insertUserErr } = await supabase
    .from("analysis_chats")
    .insert({
      analysis_id: id,
      user_id: user.id,
      role: "user",
      content: message.trim(),
      scope: scope ?? null,
    });

  if (insertUserErr) {
    return Response.json({ error: "Failed to save message" }, { status: 500 });
  }

  // ── Stream Qwen answer via SSE ────────────────────────────────────────
  const encoder = new TextEncoder();
  const qwenStream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* stream already cancelled — drop frame */
        }
      };

      let fullContent = "";
      try {
        const qwen = getQwenClient();
        const chatParams = {
          model: QWEN_REASONING_MODEL,
          messages,
          stream: true as const,
          temperature: 0.3,
          max_tokens: 2000, // safety ceiling: bound runaway streamed answer
        };
        (chatParams as Record<string, unknown>).enable_thinking = false; // DashScope extension: thinking-off
        const stream = await qwen.chat.completions.create(chatParams);

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            send("token", { delta });
          }
        }

        // Persist assistant turn after stream completes
        await supabase.from("analysis_chats").insert({
          analysis_id: id,
          user_id: user.id,
          role: "assistant",
          content: fullContent,
          scope: scope ?? null,
        });

        send("done", { content: fullContent });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Stream error",
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

  return new Response(qwenStream, { headers: sseHeaders() });
}
