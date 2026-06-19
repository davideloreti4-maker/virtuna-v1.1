/**
 * chat-runner.ts — Open-chat pipeline (Plan 05-01, Task 1).
 *
 * Streams a profile-grounded Qwen markdown answer for the open thread (THREAD-03 / D-07/D-08).
 *
 * Pipeline:
 *   1. COLD-START SIGNAL (D-08): isColdStart(profileRow) — reuses the SAME thin-profile
 *      predicate the assembler applies internally (isProfileThin). Not a second divergent
 *      definition — the exact same field-null check. Exported for the route to emit the
 *      structured coldStart meta frame (Plan 05-03 gates the one-time nudge on this).
 *
 *   2. ASSEMBLE: assembleBundle({ ask, platform, mode: "chat", anchor? }, profileRow)
 *      — the chat stance-slice + honest cold-start flag + running-turns anchor ride this
 *      with zero schema change. MODE_ROLES.chat = niche/audience/platform (D-07 tight slice).
 *
 *   3. STREAM: getQwenClient().chat.completions.create({ model: QWEN_REASONING_MODEL,
 *      messages: [{role:"system", content: KC_CHAT_SYSTEM_PROMPT}, {role:"user", content:…}],
 *      stream: true, temperature: 0.3 }). Yields token deltas via async generator.
 *
 *   4. RESULT: returns { fullContent: string; coldStart: boolean } after all tokens emitted.
 *
 * ISOLATION: imports ONLY from its declared dependency surface.
 *   - assembler.ts (assembleBundle, AssemblerInput, ProfileRow)
 *   - compiled.ts (KC_CHAT_SYSTEM_PROMPT)
 *   - qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL)
 *
 * Qwen-only constraint (THREAD-03 / STATE Hard Constraints). No engine scoring core.
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ─── Generation call timeout ───────────────────────────────────────────────────

/** Chat generation timeout — matches ideas/hooks runners (300s). */
const GENERATE_TIMEOUT_MS = 300_000;

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ChatPipelineInput {
  /** Creator's chat message (the question or statement). */
  ask: string;
  /** Target platform — used by assembleBundle for MODE_ROLES.chat grounding. */
  platform: AssemblerInput["platform"];
  /** Creator profile (null = cold-start / thin; graceful degrade to baselines, D-08). */
  profileRow: ProfileRow | null;
  /**
   * Prior conversation turns serialized for the assembleBundle `anchor` field.
   * The assembler fences this in <<<USER_CONTENT>>> — injection-safe (D-07).
   */
  priorTurns?: Array<{ role: "user" | "assistant"; text: string }>;
  /**
   * Active audience for this run (08-04 — steer closure, AUD-STEER; mirrors 07-04 ideas-runner).
   * null or is_general → profile-only grounding (byte-identical no-op for General). Chat runs
   * no Flash, so the steer is the audience-grounding line folded into assembleBundle.overrides.
   */
  audience?: Audience | null;
}

// ─── Result type ─────────────────────────────────────────────────────────────

export interface ChatPipelineResult {
  /** Full accumulated markdown response text for persistence. */
  fullContent: string;
  /** True when the profile is thin/null — the route emits this as a structured meta frame (D-08). */
  coldStart: boolean;
}

// ─── isColdStart ──────────────────────────────────────────────────────────────

/**
 * Determine whether a profile row is thin / absent — the cold-start predicate.
 *
 * MIRRORS assembler.ts `isProfileThin` EXACTLY (not a divergent definition — D-08):
 *   null row → thin; row with all null/empty fields → thin.
 * Exported so the chat route can emit the structured `coldStart` meta frame independently
 * of the runner result (before the stream starts — D-08 nudge signal).
 *
 * Do NOT modify this predicate independently of assembler.ts:isProfileThin.
 * If the assembler's thin-profile rule changes, update both in lockstep.
 */
export function isColdStart(profileRow: ProfileRow | null): boolean {
  if (profileRow === null) return true;
  const hasNiche = Boolean(profileRow.niche_primary);
  const hasAudience = Boolean(profileRow.target_audience);
  const hasGoals = Boolean(profileRow.primary_goal);
  const hasWins = Boolean(profileRow.past_wins?.length);
  const hasFlops = Boolean(profileRow.past_flops?.length);
  const hasPlatform = Boolean(profileRow.target_platforms?.length);
  return !hasNiche && !hasAudience && !hasGoals && !hasWins && !hasFlops && !hasPlatform;
}

// ─── Anchor serializer ────────────────────────────────────────────────────────

/**
 * Serialize prior conversation turns into a plain-text anchor string for assembleBundle.
 * Format mirrors the thread's natural reading order (oldest first, role: text pairs).
 * assembleBundle fences this in <<<USER_CONTENT>>> (injection-safe — D-07).
 */
function serializePriorTurns(
  turns: Array<{ role: "user" | "assistant"; text: string }>,
): string {
  return turns
    .map((t) => `${t.role === "user" ? "Creator" : "Numen"}: ${t.text}`)
    .join("\n");
}

// ─── runChatPipeline ─────────────────────────────────────────────────────────

/**
 * Stream a profile-grounded Qwen markdown answer for the open chat thread.
 *
 * USAGE (async generator pattern):
 *   const gen = runChatPipeline(input, onToken);
 *   const result = await gen;  // { fullContent, coldStart }
 *
 * The route consumes this via the callback: for each token delta, `onToken(delta)` is called
 * immediately (SSE send). After all tokens, returns { fullContent, coldStart }.
 *
 * @param input     Chat pipeline input (ask, platform, profileRow, priorTurns).
 * @param onToken   Callback invoked per token delta (string). Route pushes these to the SSE stream.
 * @returns         { fullContent: string; coldStart: boolean }
 */
export async function runChatPipeline(
  input: ChatPipelineInput,
  onToken: (delta: string) => void,
): Promise<ChatPipelineResult> {
  const { ask, platform, profileRow, priorTurns = [], audience = null } = input;

  // ── COLD-START SIGNAL (D-08) ──────────────────────────────────────────────
  const coldStart = isColdStart(profileRow);

  // ── STEER (08-04 / AUD-STEER): audience-grounding line replaces buildGroundingLine ──
  // Chat runs no Flash; the only steer vector is the assembled bundle. For a calibrated
  // audience the audience-facing line is folded into assembleBundle.overrides so the answer
  // is grounded on the active audience. General/null → undefined override (byte-identical).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  const audienceOverride = isCalibrated ? `Answer for this audience — ${groundingLine}` : undefined;

  // Weights resolved to mirror the shipped 07-04 shape (DEFAULT for General — no override).
  const resolvedWeights = resolveAudienceWeights(audience ? [audience] : []);
  void resolvedWeights; // wired for future Max-path integration; chat has no Flash scoring path

  // ── ASSEMBLE: per-request live-tier grounding bundle (D-07) ──────────────
  // Serialise prior turns into the assembleBundle `anchor` field (chat running context).
  // assembleBundle fences the anchor in <<<USER_CONTENT>>> — injection-safe.
  const anchorText = priorTurns.length > 0 ? serializePriorTurns(priorTurns) : undefined;

  const userMessage = assembleBundle(
    {
      ask,
      platform,
      mode: "chat",
      ...(anchorText ? { anchor: anchorText } : {}),
      ...(audienceOverride ? { overrides: audienceOverride } : {}),
    },
    profileRow,
  );

  // ── STREAM: Qwen generation (D-07 temperature 0.3 — matches grounded chat route) ──
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let fullContent = "";
  try {
    const ai = getQwenClient();
    const stream = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system" as const, content: KC_CHAT_SYSTEM_PROMPT },
          { role: "user" as const, content: userMessage },
        ],
        stream: true,
        temperature: 0.3,
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullContent += delta;
        onToken(delta);
      }
    }
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(
      error.name === "AbortError"
        ? `runChatPipeline: aborted (timeout ${GENERATE_TIMEOUT_MS}ms)`
        : `runChatPipeline: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  return { fullContent, coldStart };
}
