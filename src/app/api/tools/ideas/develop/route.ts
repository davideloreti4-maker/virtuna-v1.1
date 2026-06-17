/**
 * /api/tools/ideas/develop — PINNED chain-anchor endpoint (Plan 03-03, Task 2).
 *
 * POST — "Develop this →" seam: the user selects an idea and this endpoint:
 *   1. Validates auth + caps anchor length server-side (WARNING-5).
 *   2. Fences anchor via assembleBundle ({mode:"hooks", anchor}) for the future Hooks call.
 *   3. Gets/creates the user's open thread (createOpenThreadLazy).
 *   4. Appends a Hooks PLACEHOLDER message to the SAME open thread.
 *   5. Returns { threadId, messageId } so Plan 04's Hooks CTA can continue in-thread.
 *
 * The Hooks GENERATION is NOT built here — deferred to Plan 04 (D-15).
 * This endpoint ships the anchor write + in-thread append seam (RESEARCH Pattern 6).
 *
 * PINNED ENDPOINT CONTRACT (WARNING-1 — recorded in 03-03-SUMMARY.md):
 *   POST /api/tools/ideas/develop
 *   Payload: { ideaId?: string, anchor: string, platform: string }
 *   Response: { threadId: string, messageId: string }
 *
 * Security mitigations (T-03-07 – T-03-12):
 *   - Auth before any DB read (T-03-07)
 *   - user_id from session only, never body (T-03-08/CR-01)
 *   - anchor length cap server-side (T-03-10/WARNING-5)
 *   - assembleBundle injection fence wraps anchor (T-03-09)
 *   - Placeholder block validated by insertMessage at write boundary (T-03-11)
 */

import { createClient } from "@/lib/supabase/server";
import { assembleBundle } from "@/lib/kc/assembler";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";

// ── Cap constants ─────────────────────────────────────────────────────────────
// anchor is a full idea concept — allow more chars than a chat turn
const MAX_ANCHOR_LENGTH = 5000;

// ── POST /api/tools/ideas/develop ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-03-07) ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { anchor?: unknown; platform?: unknown; ideaId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const anchor = typeof body.anchor === "string" ? body.anchor : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";
  const ideaId = typeof body.ideaId === "string" ? body.ideaId : undefined;

  if (!anchor.trim()) {
    return Response.json({ error: "anchor is required" }, { status: 400 });
  }

  // SERVER-SIDE ANCHOR CAP (WARNING-5): independent of client
  if (anchor.length > MAX_ANCHOR_LENGTH) {
    return Response.json(
      { error: `anchor must be at most ${MAX_ANCHOR_LENGTH} characters` },
      { status: 400 },
    );
  }

  const platform = (
    ["tiktok", "instagram", "youtube"].includes(rawPlatform) ? rawPlatform : "tiktok"
  ) as "tiktok" | "instagram" | "youtube";

  // ── (3) Fence anchor via assembleBundle for future Hooks call (T-03-09) ──
  // We assemble the hooks bundle now to prove the injection fence is applied.
  // Plan 04 will use this fenced bundle as its Qwen user message for generation.
  // Here we store it as provenance in the placeholder block (not executed yet).
  const fencedHooksBundle = assembleBundle(
    { ask: "Generate hooks for this idea", platform, mode: "hooks", anchor },
    null, // Hooks bundle doesn't need profile grounding for the placeholder
  );

  // ── (4) Get/create open thread ────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (5) Append Hooks placeholder message to the open thread ───────────────
  // A typed markdown block: honest P4 affordance, not model-generated markup.
  // Plan 04 will replace this affordance with generated Hooks cards.
  const placeholderBlock = {
    type: "markdown" as const,
    props: {
      text:
        `**Hooks coming in P4** — your idea "${anchor.slice(0, 80)}${anchor.length > 80 ? "…" : ""}" ` +
        `is queued for hook generation.\n\n` +
        `_Tap "Generate hooks" when ready to develop ${ideaId ? `idea ${ideaId}` : "this idea"} into ` +
        `3 audience-tested hook variants._`,
    },
  };

  const msgRow = await insertMessage(openThread.id, "assistant", [placeholderBlock]);

  // ── (6) Return thread + message ids for Plan 04's CTA ────────────────────
  // Also return the fenced bundle so Plan 04 can pass it directly to Hooks generation.
  return Response.json({
    threadId: openThread.id,
    messageId: msgRow.id,
    // Plan 04 reads this to avoid re-assembling — the fence is already applied.
    fencedHooksBundle,
    ideaId: ideaId ?? null,
  });
}
