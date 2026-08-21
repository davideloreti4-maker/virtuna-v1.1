/**
 * revise-remix-tool.ts — `revise_remix`, the FREE chat-agent tool that rewrites specific beats of
 * an already-generated remix shoot sheet (phase 5, spec §6.2-§6.4).
 *
 * Follows `corpus-tool.ts`'s split: a plain `as const` schema constant + a handler that never
 * throws. Unlike `search_corpus` it needs no model call of its own to GATHER anything — it loads
 * one row, calls `reviseBeats` once, and writes back through the variant-isolated RPC
 * (`updateVariantScript`, blueprint-repo.ts). "One row serves ALL of a run's ranked cards" (§6.3)
 * is why `variant` has no default: a guessed variant would silently rewrite a sibling card's sheet,
 * and that failure renders as a sheet, not as a bug.
 *
 * FREE by design (§6.2): the run — not the ~200-token rewrite of one beat on a sheet already paid
 * for — is the billed unit. `chat-agent-loop.ts` binds this tool unconditionally and dispatches it
 * BEFORE the skill lookup, exactly like `request_input` and `emit_card`, so it can never be
 * mistaken for an unbound paid skill and answered with the credit line.
 *
 * §6.6: a revision can rewrite `spoken` / `on_screen_text` / `shot` — never the hook, angle, or
 * who-it's-for, which live frozen on the persisted card block, not on the row. The tool's own
 * description says so, so the model does not accept a hook revision it would silently drop.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBlueprint as getBlueprintDefault,
  updateVariantScript as updateVariantScriptDefault,
} from "@/lib/remix/blueprint-repo";
import { reviseBeats as reviseBeatsDefault } from "@/lib/engine/remix/revise";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

/** OpenAI/DashScope tool schema. Handed to `chat.completions.create({ tools: [REVISE_REMIX_TOOL] })`. */
export const REVISE_REMIX_TOOL = {
  type: "function",
  function: {
    name: "revise_remix",
    description:
      "Rewrite specific BEATS of an already-generated remix shoot sheet, from the creator's own " +
      "words about what's wrong with them (e.g. \"beat 2 is too soft, make it punchier\"). " +
      "Get `blueprintId` and `variant` ONLY from a `remix_sheets` entry in the thread's data — " +
      "never invent, guess, or ask the creator to type an id. One blueprint row serves EVERY " +
      "ranked card from that run, so the wrong `variant` silently rewrites a different card's " +
      "sheet — always use the `variant` from the SAME remix_sheets entry as the `blueprintId`. " +
      "This tool can ONLY rewrite the targeted beats' spoken line, on-screen text, and shot " +
      "direction — it CANNOT change the hook, angle, or who it's for (those are frozen on the " +
      "card, not on this row). If the creator's note is really about the hook, say so plainly " +
      "instead of calling this and silently dropping that part of the note.",
    parameters: {
      type: "object",
      properties: {
        blueprintId: {
          type: "string",
          description: "The sheet's id, copied EXACTLY from a remix_sheets entry on screen.",
        },
        variant: {
          type: "integer",
          minimum: 0,
          description:
            "WHICH ranked card to revise — the `variant` from the SAME remix_sheets entry as " +
            "`blueprintId`. Never guess or default this.",
        },
        beats: {
          type: "array",
          items: { type: "integer" },
          minItems: 1,
          description: "Which beat index/indexes to rewrite (0-based), e.g. [2] for beat 2 alone.",
        },
        note: {
          type: "string",
          description: "The creator's own complaint about those beats, in their own words.",
        },
      },
      required: ["blueprintId", "variant", "beats", "note"],
    },
  },
} as const;

/** What the model gets back — matches spec §7's `{ok: true, revised, variant}` on success exactly. */
export interface ReviseRemixResult {
  ok: boolean;
  error?: string;
  /** Beat indexes actually revised (post-filter). Present on every `ok:true` result, including a no-op ([]). */
  revised?: number[];
  variant?: number;
}

/**
 * Everything the handler needs. `service` + `userId` are the write identity (the SERVICE client +
 * the resolved user id, mirroring `getBlueprint`'s existing ownership-scoped read); the three repo
 * functions are injectable (hermetic tests) and default to the real ones. `onRevised` is the
 * loop's free-tool side channel (`ChatAgentStreamInput.onRevised`) — threaded in here, not called
 * by the loop directly, because only the handler knows whether the write actually happened.
 *
 * `service`/`userId` are optional so a caller that forgets to wire them gets an honest refusal
 * (mirrors `SkillBilling`'s fail-closed contract) instead of a crash — the schema stays bound
 * either way, per spec §6.2's "bind unconditionally".
 */
export interface ReviseRemixDeps {
  service?: SupabaseClient;
  userId?: string;
  getBlueprint?: typeof getBlueprintDefault;
  updateVariantScript?: typeof updateVariantScriptDefault;
  reviseBeats?: typeof reviseBeatsDefault;
  onRevised?: (info: { blueprintId: string; variant: number }) => void;
}

interface ParsedArgs {
  blueprintId: string;
  variant: number;
  beats: number[];
  note: string;
}

/** Strict parse — anything off-shape refuses honestly rather than running with a guessed value. */
function parseArgs(raw: unknown): ParsedArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const blueprintId = typeof a.blueprintId === "string" ? a.blueprintId.trim() : "";
  if (!blueprintId) return null;

  const variant = a.variant;
  if (typeof variant !== "number" || !Number.isInteger(variant) || variant < 0) return null;

  if (!Array.isArray(a.beats) || a.beats.length === 0) return null;
  const beats = [...new Set(a.beats.filter((b): b is number => typeof b === "number" && Number.isInteger(b)))];
  if (beats.length === 0) return null;

  const note = typeof a.note === "string" ? a.note.trim() : "";
  if (!note) return null;

  return { blueprintId, variant, beats, note };
}

/**
 * Run one `revise_remix` call. Never throws — every failure path (malformed args, no ownership, a
 * bad variant, a generator refusal, a failed write, or an unexpected exception from the repo layer
 * itself) returns an honest `{ok:false, error}` the loop relays as the tool result.
 */
export async function handleReviseRemix(
  rawArgs: unknown,
  deps: ReviseRemixDeps,
): Promise<ReviseRemixResult> {
  try {
    const args = parseArgs(rawArgs);
    if (!args) {
      return {
        ok: false,
        error:
          "malformed revise_remix call — need blueprintId (string), variant (integer ≥ 0), a " +
          "non-empty beats array, and a note",
      };
    }

    if (!deps.service || !deps.userId) {
      // No write seam wired — fail closed like SkillBilling's "no seam" case, never crash.
      return { ok: false, error: "revise isn't available right now" };
    }

    const getBlueprint = deps.getBlueprint ?? getBlueprintDefault;
    const updateVariantScript = deps.updateVariantScript ?? updateVariantScriptDefault;
    const reviseBeats = deps.reviseBeats ?? reviseBeatsDefault;

    // Ownership by predicate — getBlueprint already scopes id AND user_id (blueprint-repo.ts).
    const row = await getBlueprint(deps.service, args.blueprintId, deps.userId);
    if (!row) {
      return { ok: false, error: "that sheet isn't yours or doesn't exist" };
    }

    const variantScript = row.script[args.variant];
    if (!variantScript) {
      return { ok: false, error: `variant ${args.variant} doesn't exist on this sheet` };
    }

    // Filter to beat indexes this variant actually has — never insert a beat that isn't there.
    const targets = args.beats.filter((idx) => variantScript.some((b) => b.index === idx));
    if (targets.length === 0) {
      // Clean no-op: nothing to revise, nothing written, nothing to refetch.
      return { ok: true, revised: [], variant: args.variant };
    }

    const revised = await reviseBeats({
      beats: row.blueprint.beats,
      current: variantScript,
      targets,
      note: args.note,
    });
    if (!revised) {
      return { ok: false, error: "couldn't revise those beats — try again" };
    }

    // Merge by index (remix-beats.tsx:181's idiom) — never assume the revised order matches the
    // script's own order, and never touch a beat that was not targeted.
    const merged: AdaptedBeat[] = variantScript.map(
      (beat) => revised.find((r) => r.index === beat.index) ?? beat,
    );

    const wrote = await updateVariantScript(deps.service, args.blueprintId, deps.userId, args.variant, merged);
    if (!wrote) {
      return { ok: false, error: "couldn't save the revision — try again" };
    }

    deps.onRevised?.({ blueprintId: args.blueprintId, variant: args.variant });
    return { ok: true, revised: targets, variant: args.variant };
  } catch (err) {
    // getBlueprint throws on a genuine fault (e.g. an unapplied migration) rather than returning
    // null — that must stay loud in the logs but never crash a mid-stream turn.
    return { ok: false, error: err instanceof Error ? err.message : "revise failed" };
  }
}
