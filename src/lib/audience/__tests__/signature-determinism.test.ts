/**
 * Phase 2 (Trustworthy-SIM Spike) Plan 01 — signature determinism regression gate (KEEP).
 *
 * The surviving spike artifact (D-05) and Phase 3's free-by-construction regression
 * foundation (TRUST-01). Proves the determinism + normalization legs of TRUST-03 as
 * automated, CI-safe, ZERO-NETWORK assertions — independent of any paid live run.
 * (The make-or-break LLM-determinism question — does thinking-mode honor the seed —
 * is answered by the live probe in 02-02; THIS file locks the assembly + normalization
 * + tiering rule so P3 inherits a green gate.)
 *
 * Mirrors the dep-injection / mock-first pattern of enrich-signature.test.ts:190-197.
 * All three `EnrichDeps` (watchVideo / fetchSubtitle / synthesize) are stubbed with
 * RECORDED fixtures, so `enrichSignature` runs with zero DashScope / Apify calls.
 *
 * Test runner (CRITICAL repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts
 * NEVER `npm test` / `npx vitest` — they emit fake PASS(0)/FAIL(0).
 */

import { describe, it, expect, vi } from "vitest";
import { enrichSignature, type EnrichDeps } from "../enrich-signature";
import { signatureEqual, normalizeSignature, stableStringify } from "../signature-equality";
import { SOCIALS_PACK } from "@/lib/engine/packs/socials";
import input from "./fixtures/bake-input.fixture.json";
import recorded from "./fixtures/bake-llm-outputs.fixture.json";

// Recorded LLM outputs replayed as deps → zero network. `synth`/`watchNotes` were
// captured from a live bake's first run (the shapes mirror makeSynth()/WATCH_NOTE in
// enrich-signature.test.ts); replaying them makes the bake byte-deterministic by
// construction so the test isolates the ASSEMBLY + NORMALIZATION determinism.
const replayDeps: EnrichDeps = {
  watchVideo: async () => recorded.watchNotes[0] as never,
  fetchSubtitle: async () => recorded.subtitle ?? null,
  synthesize: async () => recorded.synth as never,
};

describe("signature determinism (replay gate)", () => {
  it("two assemblies from identical inputs + replay deps are byte-identical post-normalization", async () => {
    const a = await enrichSignature(input as never, replayDeps);
    const b = await enrichSignature(input as never, replayDeps);
    expect(signatureEqual(a, b)).toBe(true);
  });

  it("proves provenance.scraped_at is the ONLY pre-normalization delta (Assumption A1)", async () => {
    // Pin distinct system times across the two bakes so scraped_at provably differs
    // (it is `new Date().toISOString()` at assembly — enrich-signature.ts:484).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const a = await enrichSignature(input as never, replayDeps);
    vi.setSystemTime(new Date("2026-01-02T12:34:56.000Z"));
    const b = await enrichSignature(input as never, replayDeps);
    vi.useRealTimers();

    // scraped_at IS volatile (differs every bake) ...
    expect(a.provenance.scraped_at).not.toBe(b.provenance.scraped_at);
    // ... so the raw signatures differ ...
    expect(stableStringify(a)).not.toBe(stableStringify(b));

    // ... but scraped_at is the WHOLE delta: zero it on both and they are byte-identical.
    const aZeroed = JSON.parse(JSON.stringify(a));
    const bZeroed = JSON.parse(JSON.stringify(b));
    aZeroed.provenance.scraped_at = "ZEROED";
    bZeroed.provenance.scraped_at = "ZEROED";
    expect(stableStringify(aZeroed)).toBe(stableStringify(bZeroed));

    // And the production normalization rule is exactly this strip.
    expect(normalizeSignature(a)).toEqual(normalizeSignature(b));
  });

  it("normalizeSignature leaves every load-bearing field untouched (only scraped_at changes)", async () => {
    const sig = await enrichSignature(input as never, replayDeps);
    const norm = normalizeSignature(sig);

    // scraped_at zeroed ...
    expect(norm.provenance.scraped_at).toBe("1970-01-01T00:00:00.000Z");
    expect(norm.provenance.scraped_at).not.toBe(sig.provenance.scraped_at);

    // ... everything else identical (load-bearing fields untouched).
    expect(norm.creator_persona).toEqual(sig.creator_persona);
    expect(norm.audience).toEqual(sig.audience);
    expect(norm.summary).toEqual(sig.summary);
    expect(norm.provenance.handle).toBe(sig.provenance.handle);
    expect(norm.provenance.videos_analyzed).toBe(sig.provenance.videos_analyzed);
    expect(norm.provenance.videos_watched).toBe(sig.provenance.videos_watched);
    expect(norm.provenance.sub_coverage).toBe(sig.provenance.sub_coverage);
    // 100% of reactors carry evidence — the substrate the provenance leg inspects.
    expect(norm.audience.personas).toHaveLength(10);
    for (const p of norm.audience.personas) {
      expect(p.evidence.trim().length).toBeGreaterThan(0);
    }
  });
});

/**
 * Trust-tiering leg of TRUST-03 (D-04). No Validated/Directional RESOLVER exists yet —
 * the spike ASSERTS the rule as a pure predicate; Phase 3 (TRUST-01) builds the badge
 * resolver in src/. Keep the predicate LOCAL to this test (over-building a src/ resolver
 * here breaks D-05 scope).
 *
 * The tier keys off `DomainPack.calibration` (the trust-tier basis), NEVER
 * `Audience.calibration` (scrape provenance) — do not conflate the two (02-RESEARCH
 * anti-pattern). A pack carrying a non-empty calibration baseline is the Validated
 * anchor; a no-calibration SIM (e.g. General) resolves Directional BY RULE.
 */
type TrustTier = "Validated" | "Directional";

/** A SIM is Validated iff its pack carries a non-empty calibration baseline; else Directional. */
function resolveTier(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}

describe("trust tiering rule (Directional by rule)", () => {
  it("a calibration-bearing pack (Socials) resolves Validated", () => {
    // Read only the baselineRef shape — do not depend on the heavy pack internals.
    const socialsCalibration = { baselineRef: SOCIALS_PACK.calibration?.baselineRef };
    expect(socialsCalibration.baselineRef).toBeTruthy();
    expect(resolveTier(socialsCalibration)).toBe("Validated");
  });

  it("a no-calibration SIM (General) resolves Directional by rule — never Validated", () => {
    expect(resolveTier(undefined)).toBe("Directional");
    expect(resolveTier({})).toBe("Directional");
    expect(resolveTier({ baselineRef: "" })).toBe("Directional");
    expect(resolveTier(undefined)).not.toBe("Validated");
  });
});
