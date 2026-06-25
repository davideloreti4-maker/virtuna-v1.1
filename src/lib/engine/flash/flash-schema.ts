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

// ─── Batched result schema (S3′ — generate-rate-rank) ───────────────────────────
// One batched SIM call scores N unrelated candidates, each by all 10 archetypes.
// Per-candidate salvage (coerceFlashBatchResponse + per-candidate safeParse in the
// call fn) means a single malformed candidate drops ITSELF — never nukes the batch.
// Shape is domain-general (candidates[] → reactions[]) so the GSI DomainPack seam
// stays clean (memory numen-gsi-vision): only the persona/verdict/band specifics
// (socials Pack #1) live in FlashPersonaSchema above.

export const FlashBatchCandidateSchema = z.object({
  id: z.string(),
  personas: z.array(FlashPersonaSchema).length(10),
});

export type FlashBatchCandidate = z.infer<typeof FlashBatchCandidateSchema>;

export const FlashBatchResultSchema = z.object({
  candidates: z.array(FlashBatchCandidateSchema),
});

export type FlashBatchResult = z.infer<typeof FlashBatchResultSchema>;

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

// ─── Batched coercion (S3′) ──────────────────────────────────────────────────────
// Normalizes a raw batched response into one entry per EXPECTED id, resolving by the
// echoed id and falling back to positional order if ids drift. Each entry's personas
// stay raw here (verdict casing etc. are normalized per-candidate by coerceFlashResponse
// in the call fn) so the existing single-candidate salvage path is reused verbatim.
//
// Tolerates: fenced JSON string · bare top-level array · {candidates:[…]} · {results:[…]} ·
// a candidate that is itself a bare personas array. A missing/unparseable candidate yields
// { id, personas: undefined } → fails the per-candidate safeParse → dropped (not the batch).
export function coerceFlashBatchResponse(
  raw: unknown,
  expectedIds: string[],
): { id: string; personas: unknown }[] {
  let r = raw;

  // Fenced/string JSON → parse (mirrors coerceFlashResponse).
  if (typeof r === "string") {
    const stripped = stripModelOutput(r);
    try {
      r = JSON.parse(stripped);
    } catch {
      return expectedIds.map((id) => ({ id, personas: undefined }));
    }
  }

  // Locate the candidates array: bare array | {candidates} | {results}.
  let arr: unknown[] = [];
  if (Array.isArray(r)) {
    arr = r;
  } else if (r && typeof r === "object") {
    const o = r as { candidates?: unknown; results?: unknown };
    if (Array.isArray(o.candidates)) arr = o.candidates;
    else if (Array.isArray(o.results)) arr = o.results;
  }

  // Index entries by echoed id + keep positional order for fallback.
  const byId = new Map<string, unknown>();
  const positional: unknown[] = [];
  for (const entry of arr) {
    let id: string | undefined;
    let personas: unknown;
    if (Array.isArray(entry)) {
      personas = entry; // candidate emitted as a bare personas array
    } else if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (typeof e.id === "string") id = e.id;
      personas = e.personas ?? e.reactions;
    }
    if (id != null) byId.set(id, personas);
    positional.push(personas);
  }

  // Resolve each expected id: by id, else positional fallback.
  return expectedIds.map((id, i) => ({
    id,
    personas: byId.has(id) ? byId.get(id) : positional[i],
  }));
}
