/**
 * Revise generator — Phase 5 (revise_remix, spec §6.4).
 *
 * One Qwen JSON-mode call that rewrites the targeted beat indexes of an already-adapted script
 * against the stored source skeleton. No resolve, no Omni, no re-rank — the source mp4 is gone by
 * the time a creator asks for this, and that is the point (spec §6.1).
 *
 * Input structural guard, same idiom as `AdaptInput` (decode-types.ts:203): `ReviseInput` has no
 * field for luck, caption, or persona, so none of those can reach the prompt — input fencing, not
 * output filtering (spec §6.8.2; there is no echo/n-gram guard in this codebase by ruling).
 *
 * Unlike `adapt.ts`, there is no repair-retry loop: spec §6.4 says "one LLM call", and half a
 * revision is worse than a refusal (the `stripInvalidScript` philosophy, adapt.ts:264) — a
 * validation failure here returns null outright rather than spending a second attempt on it.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { z } from "zod";
import { AdaptedBeatZodSchema, trimToCap } from "./adapt";
import type { SourceBlueprint } from "./blueprint";
import type { AdaptedBeat } from "./decode-types";

const log = createLogger({ module: "engine.remix.revise" });

// A handful of beats, never a full sheet — adapt.ts's 90s budget is sized for a whole script.
const TIMEOUT_MS = 60_000;
// Bounded by target count, not fixed: a 1-beat revision needs far fewer tokens than an 8-beat one,
// and an unused ceiling costs nothing (mirrors adapt.ts's max_tokens comment). 600 is derived from
// AdaptedBeatZodSchema's OWN maximum, not from measured usage: spoken(600) + shot(600) + repair(400)
// + on_screen_text(300) = 1900 chars of content per beat, before the JSON structural overhead
// (keys/quotes/braces) each entry also costs. A 450-token ceiling (150 + 1×300) measured live
// truncated a fully VALID 1-beat response (JSON cut mid-string, 1 of 17 calls) — this is the fix.
const BASE_TOKENS = 150;
const TOKENS_PER_BEAT = 600;
// Matches AdaptedBeatZodSchema's inline `repair: z.string().max(400)` (adapt.ts) — kept in sync by
// hand, same as that schema's own caps are inline literals with no shared constant.
const REPAIR_CAP = 400;

export const REVISE_SYSTEM_PROMPT = `You are revising specific beats of an adapted shoot script, against feedback from the creator who will film it.

For each targeted beat you are given:
- the SOURCE beat: what the original video did at that point (timing, visual, and speech if any)
- the CURRENT line: what the creator's version currently says/shows for that beat — the one you are replacing
- the creator's NOTE: their complaint, in their own words, about the current line(s)

Rewrite ONLY the targeted beats. Do not invent new beats, do not touch any beat that was not targeted, and keep each beat's "index" exactly as given.

Borrow the SHAPE of the source beat — its cadence, its pacing, where it lands its emphasis — never its subject. The revised line must share no topic words with the source.

OUTPUT: Return strict JSON with this exact shape and nothing else:
{
  "beats": [
    {
      "index": <the beat's index, copied from the targeted beat>,
      "spoken": "<what the creator SAYS in this beat — empty string when there is no speech>",
      "on_screen_text": "<overlay text for this beat — empty string when there is none>",
      "shot": "<how to shoot this beat: framing, camera position, movement>",
      "repair": "<ONLY when useful: what you changed and why, addressing the creator's note>"
    }
  ]
}
The "beats" array MUST contain EXACTLY one entry per targeted beat, in the same order, with "index" preserved.`;

const ReviseResponseZodSchema = z.object({
  beats: z.array(AdaptedBeatZodSchema).min(1),
});

/**
 * `repair` is optional advisory metadata — what changed and why — never load-bearing prose a
 * shoot sheet is useless without, unlike `spoken`/`shot`/`on_screen_text`. Measured live: 3 of 17
 * calls discarded an otherwise-VALID rewrite because `repair` alone ran over its 400-char cap.
 * Owner ruling: clamp `repair` — and ONLY `repair` — before validation, same remedy as
 * `clampOverCapProse` in adapt.ts (`trimToCap`, imported not copied). The other three capped
 * fields stay strict over-cap→null; a genuinely over-cap `spoken`/`shot`/`on_screen_text` must
 * still fail the whole beat even when `repair` on the SAME beat also over-caps.
 */
function clampOverCapRepair(parsed: unknown): unknown {
  const beats = (parsed as { beats?: unknown } | null)?.beats;
  if (!Array.isArray(beats)) return parsed;
  for (const b of beats) {
    if (!b || typeof b !== "object") continue;
    const beat = b as Record<string, unknown>;
    const repair = beat.repair;
    if (typeof repair === "string" && repair.length > REPAIR_CAP) {
      log.warn("revise returned over-cap repair — trimming it, keeping the beat", {
        index: beat.index,
        length: repair.length,
        cap: REPAIR_CAP,
      });
      beat.repair = trimToCap(repair, REPAIR_CAP);
    }
  }
  return parsed;
}

export interface ReviseInput {
  /** The source's timed structural skeleton — the same shape stored on the blueprint row. */
  beats: SourceBlueprint["beats"];
  /** The variant's current adapted script — the lines being replaced. */
  current: AdaptedBeat[];
  /** Which beat indexes to rewrite. */
  targets: number[];
  /** The creator's own words — e.g. "beat 3 is too soft". */
  note: string;
}

/**
 * Build the Qwen user-turn content. Only emits a row for a target that has BOTH a source beat and
 * a current line — a target missing either has nothing to revise against, which is why
 * `reviseBeats` pre-filters `targets` to this same set before calling here (see `promptTargets`).
 */
export function buildReviseUserContent(input: ReviseInput): string {
  const rows = input.targets
    .map((idx) => {
      const beat = input.beats.find((b) => b.index === idx);
      const current = input.current.find((c) => c.index === idx);
      if (!beat || !current) return null;

      const lines = [
        `BEAT ${idx} (${beat.t_start.toFixed(1)}–${beat.t_end.toFixed(1)}s, ${beat.duration_s}s) · ${beat.role.toUpperCase()}`,
        `  SOURCE did: ${beat.visual_event}`,
      ];
      if (beat.spoken) lines.push(`  SOURCE said: "${beat.spoken}"`);
      if (beat.on_screen_text) lines.push(`  SOURCE on-screen: "${beat.on_screen_text}"`);
      lines.push(
        `  CURRENT line — spoken: "${current.spoken}" · on_screen_text: "${current.on_screen_text}" · shot: "${current.shot}"`,
      );
      if (current.repair) lines.push(`  CURRENT repair note: "${current.repair}"`);

      return lines.join("\n");
    })
    .filter((r): r is string => r !== null)
    .join("\n\n");

  return `CREATOR'S NOTE: ${input.note}

TARGETED BEATS:
${rows}

Rewrite exactly these beats.`;
}

/**
 * Rewrite the targeted beats. Returns `null` on any validation failure — see the module docstring
 * for why there is no retry here, unlike `generateAdaptConcepts`.
 */
export async function reviseBeats(input: ReviseInput): Promise<AdaptedBeat[] | null> {
  // De-dupe, then drop any target with no source beat or no current line to revise against. A
  // target that never gets a prompt row must not be able to sneak an output beat past the
  // untargeted-index check below (spec §6.4: "the call returns only beats for indexes that
  // exist" — Task 5 is expected to filter targets against `current` first, but this holds even
  // if it doesn't).
  const targets = [...new Set(input.targets)];
  const promptTargets = targets.filter(
    (idx) => input.beats.some((b) => b.index === idx) && input.current.some((c) => c.index === idx),
  );

  if (promptTargets.length === 0) {
    log.warn("revise called with no targets resolvable against beats + current — nothing to revise");
    return null;
  }

  const ai = getQwenClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let lastError: unknown;

  try {
    const completion = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: REVISE_SYSTEM_PROMPT },
          { role: "user", content: buildReviseUserContent({ ...input, targets: promptTargets }) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        max_tokens: BASE_TOKENS + promptTargets.length * TOKENS_PER_BEAT,
        // @ts-expect-error — DashScope extension not in OpenAI SDK types
        enable_thinking: false,
      },
      { signal: controller.signal },
    );

    const choice = completion.choices[0];
    // Log this distinctly and BEFORE attempting to parse: a truncated response almost always
    // fails JSON.parse too, and that SyntaxError alone reads as the model emitting malformed
    // JSON — it isn't. The real defect is max_tokens, not the model, and the two need different
    // fixes (raise the ceiling vs. fix the prompt).
    if (choice?.finish_reason === "length") {
      log.warn("revise response truncated by max_tokens — the response was cut off, not malformed", {
        finishReason: choice.finish_reason,
        maxTokens: BASE_TOKENS + promptTargets.length * TOKENS_PER_BEAT,
      });
    }

    const raw = choice?.message?.content ?? "";
    const cleaned = stripModelOutput(raw);
    const parsed = JSON.parse(cleaned) as unknown;

    const result = ReviseResponseZodSchema.safeParse(clampOverCapRepair(parsed));
    if (!result.success) {
      log.warn("revise Zod validation failed", { error: result.error.message });
      return null;
    }

    // index ∈ promptTargets, each present at most once, ALL of them present — a partial or
    // over-declared response is rejected whole (all-or-nothing per call).
    const seen = new Set<number>();
    for (const beat of result.data.beats) {
      if (!promptTargets.includes(beat.index)) {
        log.warn("revise returned a beat for an untargeted index — rejecting the whole response", {
          index: beat.index,
          targets: promptTargets,
        });
        return null;
      }
      if (seen.has(beat.index)) {
        log.warn("revise returned a duplicate index — rejecting the whole response", {
          index: beat.index,
        });
        return null;
      }
      seen.add(beat.index);
    }

    if (seen.size !== promptTargets.length) {
      log.warn("revise returned fewer beats than targeted — half a revision is worse than a refusal", {
        returned: seen.size,
        targeted: promptTargets.length,
      });
      return null;
    }

    log.info("revise beats generated", { count: result.data.beats.length });
    return result.data.beats;

  } catch (err: unknown) {
    lastError = err;
    log.warn("revise attempt failed", { error: String(err) });
  } finally {
    clearTimeout(timer);
  }

  Sentry.captureException(lastError, { tags: { stage: "remix_revise" } });
  return null;
}
