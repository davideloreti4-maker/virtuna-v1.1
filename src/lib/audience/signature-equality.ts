/**
 * Phase 2 (Trustworthy-SIM Spike) Plan 01 — signature equality / normalization (KEEP).
 *
 * The surviving artifact of the spike (D-05): the determinism regression foundation
 * Phase 3 inherits free-by-construction (TRUST-01). It encodes the *entire* signature
 * normalization rule so two bakes of the same SIM (temp 0 + seed, bake-once) can be
 * proven byte-identical post-normalization.
 *
 * The normalization rule is a ONE-FIELD strip: `provenance.scraped_at` is the ONLY
 * non-deterministic field in `AudienceSignature` — set via `new Date().toISOString()`
 * at assembly time (enrich-signature.ts:484, per D-01 / Assumption A1). Every other
 * field is deterministic given identical input + `temperature:0, seed:QWEN_SEED`. The
 * replay gate in `__tests__/signature-determinism.test.ts` PROVES this (it asserts
 * scraped_at is the sole pre-normalization delta), so the rule is not assumed — it is
 * verified on every test run.
 *
 * Pure + dependency-free (type-only import). No I/O, no Date.now, no Math.random.
 */

import type { AudienceSignature } from "./audience-types";

/** The single frozen timestamp the only volatile field is zeroed to before compare. */
const FROZEN_TS = "1970-01-01T00:00:00.000Z";

/**
 * Deterministic JSON serialization: `JSON.stringify` with recursively sorted object
 * keys. Guards against key-order drift on nested objects so two structurally-equal
 * signatures serialize byte-identically regardless of property insertion order.
 * Arrays keep their order (order is load-bearing for personas); only object keys sort.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Zero the ONLY non-deterministic field (`provenance.scraped_at`) and leave every
 * load-bearing field untouched. Returns a clone — the input is not mutated.
 *
 * This is the complete normalization rule. If a future change adds a second volatile
 * field, the replay gate's "scraped_at is the only delta" assertion fails loudly
 * rather than this silently under-stripping.
 */
export function normalizeSignature(sig: AudienceSignature): AudienceSignature {
  return {
    ...sig,
    provenance: { ...sig.provenance, scraped_at: FROZEN_TS }, // ← the ONLY volatile field (enrich:484)
  };
}

/**
 * True iff two signatures are byte-identical after normalization (stripping the one
 * volatile field + stable key ordering). The signature-determinism contract.
 */
export function signatureEqual(a: AudienceSignature, b: AudienceSignature): boolean {
  return stableStringify(normalizeSignature(a)) === stableStringify(normalizeSignature(b));
}
