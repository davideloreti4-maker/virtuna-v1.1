/**
 * kc-stamp.ts — KC_GEN_VERSION provenance stamping helper (P1-deferred, now wired).
 *
 * Decoupled from ENGINE_VERSION (src/lib/engine/version.ts). The two version
 * namespaces are intentionally independent:
 *   KC_GEN_VERSION  — tracks authored Knowledge-Core content changes (this file's domain)
 *   ENGINE_VERSION  — tracks video-scoring behavior changes (engine/version.ts)
 *
 * NEVER import from engine/version.ts here (kc-version.ts header / RESEARCH Anti-Pattern).
 *
 * ─── LANDING SPOT DECISION (for Plan 03 to consume) ─────────────────────────
 *
 * The KC provenance stamp lands as a per-message metadata field on the persisted
 * message body JSONB (messages.body in Supabase), NOT as a per-block prop.
 *
 * Rationale:
 *   - One stamp per generate call (all idea-card blocks in one response share the
 *     same KC version — they were generated from the same KC_IDEA_SYSTEM_PROMPT).
 *   - message body is JSONB (can carry extra fields without schema migration, A6).
 *   - A per-block prop would redundantly repeat the same value across 3 cards
 *     and would surface in the rendered block (where it is irrelevant to the user).
 *
 * Concrete shape — Plan 03 route attaches this to the FIRST block or as a wrapper:
 *
 *   // Option A — message-level provenance block (recommended for Plan 03):
 *   const blocks = [
 *     kcStampBlock(),       // { type: "__kc_provenance__", props: { kcGenVersion: "gen.1.0.0" } }
 *     ...ideaCardBlocks,
 *   ];
 *
 *   // Option B — metadata field on the insertMessage call (requires messages schema to accept metadata):
 *   // Not used in v1 — messages.body is the canonical JSONB column; no metadata column exists.
 *
 * Plan 03 MUST use Option A (the provenance block is a non-rendered internal marker).
 * The message-blocks.tsx renderer ignores unknown block types via the UnsupportedBlock
 * fallback — but since "__kc_provenance__" is deliberately NOT registered, it will
 * silently render as UnsupportedBlock. To avoid that, Plan 03 should either:
 *   (a) Store the stamp as the LAST element and strip it before rendering, OR
 *   (b) Attach it as a plain metadata field in a wrapper object rather than a block.
 *
 * RECOMMENDATION for Plan 03 (cleaner approach, no renderer noise):
 *   Persist the stamp alongside blocks in a wrapper: { kcGenVersion, blocks: [...] }
 *   OR store it as a top-level field on the message body object rather than in the blocks array.
 *   This avoids any renderer interaction and is the idiomatic JSONB provenance pattern.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { kcStamp, KC_PROVENANCE_FIELD } from "@/lib/kc/kc-stamp";
 *
 *   // Attach to a message body wrapper (recommended — Plan 03):
 *   const messageBody = {
 *     [KC_PROVENANCE_FIELD]: kcStamp().kcGenVersion,
 *     blocks: ideaCardBlocks,
 *   };
 *
 *   // Or directly:
 *   const stamp = kcStamp(); // { kcGenVersion: "gen.1.0.0" }
 */

import { KC_GEN_VERSION } from "./kc-version";

/**
 * The field name used when embedding the KC provenance stamp in a persisted
 * message body or metadata object. Plan 03 reads this constant so the field
 * name is defined in ONE place.
 */
export const KC_PROVENANCE_FIELD = "kcGenVersion" as const;

/**
 * Produce the KC provenance stamp object.
 * Returns { kcGenVersion: "gen.X.Y.Z" } — the current KC_GEN_VERSION.
 *
 * Pure function: no side effects, no I/O, dependency-light (only kc-version.ts).
 * Callable server-side from any route without async setup.
 */
export function kcStamp(): { kcGenVersion: string } {
  return { kcGenVersion: KC_GEN_VERSION };
}

/**
 * Attach the KC provenance stamp to an existing object (convenience helper).
 * Returns a new object with the kcGenVersion field merged in.
 *
 * Example:
 *   const stamped = withKcStamp({ blocks: ideaCards });
 *   // → { blocks: [...], kcGenVersion: "gen.1.0.0" }
 */
export function withKcStamp<T extends Record<string, unknown>>(
  obj: T,
): T & { kcGenVersion: string } {
  return { ...obj, ...kcStamp() };
}
