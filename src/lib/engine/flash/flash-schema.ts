/**
 * SIM-1 Flash — Per-persona schema + coercion (Plan 01-03 Task 1).
 *
 * FlashPersona: {archetype, verdict: stop|scroll, quote (1-160 chars)} (D-03).
 * FlashResultSchema: exactly 10 personas (.length(10), mirrors FoldResponseSchema).
 * coerceFlashResponse: salvages small-model (qwen3.6-flash) TYPE/shape sloppiness:
 *   - bare top-level array → {personas: [...]}
 *   - fenced JSON string → parse + extract
 *   - verdict casing variants ("Stop", "SCROLL") → lowercase
 * Zod still enforces the hard 10-persona contract after coercion.
 *
 * Isolation: imports ONLY zod. No engine (pipeline/aggregator/version/wave3/fold) imports.
 */

import { z } from "zod";
import { stripModelOutput } from "../utils/strip";

// ─── Per-persona schema ────────────────────────────────────────────────────────
// D-03: verdict drives the aggregate band math; quote is the audience texture.
// quote: min 1 (non-empty), max 160 (one readable sentence, fits the UI chip).
// This is also the exact data shape custom personas will emit later (v6.1+, D-05).

export const FlashPersonaSchema = z.object({
  archetype: z.string(),
  verdict: z.enum(["stop", "scroll"]),
  quote: z.string().min(1).max(160),
});

export type FlashPersona = z.infer<typeof FlashPersonaSchema>;

// ─── Full result schema ───────────────────────────────────────────────────────
// .length(10) mirrors FoldResponseSchema's .length(10) — exactly 10 archetypes (D-01).

export const FlashResultSchema = z.object({
  personas: z.array(FlashPersonaSchema).length(10),
});

export type FlashResult = z.infer<typeof FlashResultSchema>;

// ─── Coercion layer ────────────────────────────────────────────────────────────
// Salvages small-model (qwen3.6-flash) FORMAT sloppiness WITHOUT fabricating signal.
// Mirrors coerceFoldResponse pattern from wave3/fold-prompts.ts.
//
// Handles:
//  1. Fenced JSON string (model wraps in ```json...```) → strip + parse
//  2. Bare top-level array → {personas: [...]}
//  3. Verdict casing variants ("Stop", "SCROLL", "Stop") → lowercase
//
// Zod enforces the hard contract (10 personas, valid verdict, quote bounds) AFTER this.

function normalizeVerdict(v: unknown): string {
  if (typeof v !== "string") return String(v ?? "");
  return v.toLowerCase().trim();
}

/**
 * Coerce a raw model response into FlashResultSchema-compatible shape.
 * Accepts: object with personas array, bare array, or fenced JSON string.
 * Returns a plain object suitable for FlashResultSchema.safeParse.
 */
export function coerceFlashResponse(raw: unknown): unknown {
  // Handle fenced JSON string — some flash models wrap output in ```json...```
  if (typeof raw === "string") {
    const stripped = stripModelOutput(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Not valid JSON after stripping — return empty personas (will fail Zod with 0 personas)
      return { personas: [] };
    }
    return coerceFlashResponse(parsed);
  }

  // Flash sometimes returns a bare array of personas instead of {personas:[...]}.
  const obj = Array.isArray(raw) ? { personas: raw } : (raw as { personas?: unknown } | null);

  const personas = Array.isArray(obj?.personas) ? obj.personas : [];

  return {
    personas: personas.map((p) => {
      const pp = (p ?? {}) as Record<string, unknown>;
      return {
        archetype: String(pp.archetype ?? ""),
        // Normalize verdict casing — flash sometimes returns "Stop", "Scroll", "STOP", "SCROLL"
        verdict: normalizeVerdict(pp.verdict),
        quote: String(pp.quote ?? ""),
      };
    }),
  };
}
