# Phase 2: Trustworthy-SIM Spike - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 7 (2 KEEP code + 3 KEEP fixtures/test + 3 THROWAWAY script files)
**Analogs found:** 7 / 7

> This is a SPIKE. Almost no production code. The only KEPT survivors are `signature-equality.ts` + its replay test (P3's regression foundation). Everything under `scripts/spike/` is THROWAWAY (D-05). All analogs verified against `main`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/audience/signature-equality.ts` (KEEP) | utility | transform | `src/lib/audience/temperature-disposition.ts` (pure deterministic util) + types from `audience-types.ts` | role-match |
| `src/lib/audience/__tests__/signature-determinism.test.ts` (KEEP) | test | transform/replay | `src/lib/audience/__tests__/enrich-signature.test.ts` | exact |
| `src/lib/audience/__tests__/fixtures/bake-input.fixture.json` (KEEP) | test fixture | file-I/O | inline fixtures in `enrich-signature.test.ts` (`makeInput`/`makeProfile`) | role-match (no fixtures/ dir exists yet — new) |
| `src/lib/audience/__tests__/fixtures/bake-llm-outputs.fixture.json` (KEEP) | test fixture | file-I/O | inline `makeSynth()` + `WATCH_NOTE` in `enrich-signature.test.ts` | role-match |
| `scripts/spike/trustworthy-sim-probe.ts` (THROWAWAY) | script/CLI | batch/event-driven | `scripts/fold-validate-r1.ts` (live one-shot evidence probe) | exact |
| `scripts/spike/chat-bundle-adapter.ts` (THROWAWAY) | utility (adapter) | transform | `EnrichInput` shape in `enrich-signature.ts:213-219` + `VideoData`/`ProfileData` in `scraping/types.ts` | role-match |
| `scripts/spike/fixtures/socials-bundle.fixture.json` (THROWAWAY) | data fixture | file-I/O | frozen `ProfileBundle`→`EnrichInput` JSON dump | new |

## Pattern Assignments

### `src/lib/audience/signature-equality.ts` (utility, transform) — KEEP

**Analog:** `src/lib/audience/temperature-disposition.ts` (pure, dependency-free, deterministic-by-construction util) + types imported from `./audience-types`.

**Volatile field is verified:** `enrich-signature.ts:484` — `scraped_at: new Date().toISOString()` is the **only** non-deterministic field in the whole `AudienceSignature` (assembly block lines 469-489; no `id`/UUID/timestamp anywhere else on the signature object).

**Core pattern** (per RESEARCH Pattern 2, verified against assembly at enrich-signature.ts:469-489):
```typescript
import type { AudienceSignature } from "./audience-types";

const FROZEN_TS = "1970-01-01T00:00:00.000Z";

/** Zero the only non-deterministic field. */
export function normalizeSignature(sig: AudienceSignature): AudienceSignature {
  return {
    ...sig,
    provenance: { ...sig.provenance, scraped_at: FROZEN_TS }, // ← ONLY volatile field (enrich:484)
  };
}

export function signatureEqual(a: AudienceSignature, b: AudienceSignature): boolean {
  return stableStringify(normalizeSignature(a)) === stableStringify(normalizeSignature(b));
}
// stableStringify = JSON.stringify with recursively sorted object keys (guards key-order drift).
```

**Self-check note (Assumption A1):** the probe should diff the FULL un-normalized pair and log every differing path — do not assume only `scraped_at` differs; prove it.

---

### `src/lib/audience/__tests__/signature-determinism.test.ts` (test, replay) — KEEP

**Analog:** `src/lib/audience/__tests__/enrich-signature.test.ts` — **exact** match for the dep-injection / mock-first pattern. Mirror it directly.

**Dep-injection pattern to copy** (enrich-signature.test.ts:190-197) — the `EnrichDeps` shape (`watchVideo`/`fetchSubtitle`/`synthesize`) is the seam; the replay test swaps live deps for recorded fixtures:
```typescript
function makeDeps(overrides: Partial<EnrichDeps> = {}): EnrichDeps {
  return {
    watchVideo: vi.fn(async () => WATCH_NOTE),
    fetchSubtitle: vi.fn(async () => "If you want more views it's called hook alignment"),
    synthesize: vi.fn(async () => makeSynth()),
    ...overrides,
  };
}
```
`EnrichDeps` interface verified at `enrich-signature.ts:204-211` (all three deps optional, default to real DashScope/fetch).

**Test structure to copy** (enrich-signature.test.ts:10, 189, 199-203) — `import { describe, it, expect, vi } from "vitest"`; `describe(...)` / `it(...)`; assert via `expect(...)`. The replay gate adds two cases (per RESEARCH Code Examples):
```typescript
import { describe, it, expect } from "vitest";
import { enrichSignature, type EnrichDeps } from "../enrich-signature";
import { signatureEqual, normalizeSignature } from "../signature-equality";
import input from "./fixtures/bake-input.fixture.json";
import recorded from "./fixtures/bake-llm-outputs.fixture.json";

const replayDeps: EnrichDeps = {
  watchVideo: async () => recorded.watchNotes[0],
  fetchSubtitle: async () => recorded.subtitle ?? null,
  synthesize: async () => recorded.synth,
};

describe("signature determinism (replay gate)", () => {
  it("two assemblies are byte-identical post-normalization", async () => {
    const a = await enrichSignature(input as any, replayDeps);
    const b = await enrichSignature(input as any, replayDeps);
    expect(signatureEqual(a, b)).toBe(true);
  });
  it("the ONLY pre-normalization delta is provenance.scraped_at", async () => {
    const a = await enrichSignature(input as any, replayDeps);
    const b = await enrichSignature(input as any, replayDeps);
    expect(a.provenance.scraped_at).not.toBe(b.provenance.scraped_at);
    expect(normalizeSignature(a)).toEqual(normalizeSignature(b));
  });
});
```

**Tiering predicate** can live in this same file (pure, zero-network) per RESEARCH:
```typescript
function resolveTier(calibration?: { baselineRef?: string }): "Validated" | "Directional" {
  return calibration?.baselineRef ? "Validated" : "Directional";
}
// SOCIALS_PACK.calibration → "Validated"; undefined (General) → "Directional"
```

**Test runner (CRITICAL quirk):** run with `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts`. NEVER `npm test`/`npx vitest` — they emit fake `PASS(0)/FAIL(0)` (repo shim bug).

---

### `src/lib/audience/__tests__/fixtures/*.fixture.json` (test fixtures) — KEEP

**Analog:** the inline fixture builders in `enrich-signature.test.ts` — `makeProfile()` (lines 27-39), `makeVideo()` (41-57), `makeSynth()` (60-86), `makeInput()` (88-96), `WATCH_NOTE` (98-106). The recorded JSON fixtures serialize the **same shapes** these builders produce, captured from the live bake instead of hand-written.

- `bake-input.fixture.json` ← the frozen `EnrichInput` (shape = `enrich-signature.ts:213-219`: `{handle, profile, videos, subCoverage, goalIntent}`).
- `bake-llm-outputs.fixture.json` ← `{ watchNotes: WatchNote[], synth: SynthSchema, subtitle?: string }` recorded from the live probe's first bake. `WatchNote` shape verified at test lines 98-106; `synth` shape = `makeSynth()` lines 60-86.

> No `__tests__/fixtures/` directory exists yet — Wave 0 creates it.

---

### `scripts/spike/trustworthy-sim-probe.ts` (script/CLI, batch) — THROWAWAY

**Analog:** `scripts/fold-validate-r1.ts` — **exact** match: a live one-shot evidence-only probe that drives real engine code, hits live Qwen, prints verdict evidence, edits no engine file.

**Script bootstrap pattern to copy** (fold-validate-r1.ts:21-41) — dotenv + tsconfig-paths register so `@/` aliases resolve in a standalone script:
```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../../.env.local") }); // NOTE: ../../ — spike/ is one level deeper
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, "../.."), paths: tsconfig.compilerOptions.paths });
```
> Adjust the relative depth: existing scripts sit in `scripts/`, the spike sits in `scripts/spike/` → use `../../` to reach repo root.

**Run command** (mirror fold-validate-r1.ts:18 header): `pnpm tsx scripts/spike/trustworthy-sim-probe.ts`.

**Env guard:** fail loudly if `DASHSCOPE_API_KEY` absent (the experiment cannot run). `APIFY_TOKEN` only needed for the one fresh scrape — if `socials-bundle.fixture.json` exists, skip the scrape and re-bake from it.

**Core probe flow** (RESEARCH Pattern 1, verified `enrichSignature` sig at enrich-signature.ts; `scrapeProfileBundle` at apify-provider.ts):
```typescript
// (1) ONE Apify call → freeze (D-01a)
const bundle = await new ApifyScrapingProvider().scrapeProfileBundle("<@handle>", 12);
const input: EnrichInput = { handle, profile: bundle.profile, videos: bundle.videos,
  subCoverage: bundle.subCoverage, goalIntent: "grow" };
// SCRUB APIFY_TOKEN / query strings from every video.mediaUrl before freezing (security note below)
writeFileSync("scripts/spike/fixtures/socials-bundle.fixture.json", JSON.stringify(input));

// (2) bake TWICE from SAME frozen input, REAL Qwen (temp 0 + seed inside enrichSignature)
const a = await enrichSignature(input);   // 3 omni + 1 synth
const b = await enrichSignature(input);   // 3 omni + 1 synth  → 8 Qwen
// diff FULL un-normalized pair (log every differing path) THEN assert normalized equality
const identical = signatureEqual(a, b);
```

**Pitfall to handle:** a watch-count mismatch (`provenance.videos_watched` differs) is **inconclusive (transport), not a determinism failure** — re-run or pin the watched set; document as caveat (Pitfall 2, defaultWatchVideo returns null on error at enrich-signature.ts:311-316).

---

### `scripts/spike/chat-bundle-adapter.ts` (utility/adapter, transform) — THROWAWAY

**Analog:** the `EnrichInput`/`VideoData`/`ProfileData` shapes (enrich-signature.ts:213-219, scraping/types.ts). The only net-new logic in the spike: map text → `EnrichInput`, skip omni via injected `watchVideo: () => null`. Reuses the real `defaultSynthesize` (same `temp:0+seed`, same `SynthSchema`). See RESEARCH Pattern 3 for the full excerpt — pack evidence into `VideoData.caption`, fold the `source=user` custom-context note into the caption text, post-process the returned signature to assert a persona's `evidence` references the note.

```typescript
// in the probe: enrichSignature(input, { watchVideo: async () => null })  → 0 omni, 1 synth ×2
```

---

### `scripts/spike/fixtures/socials-bundle.fixture.json` (data fixture) — THROWAWAY

The 1 frozen Apify scrape serialized as `EnrichInput` (D-01a). **Security:** scrub `APIFY_TOKEN` and all query strings from every `mediaUrl` before writing — `prepareWatchUrl` re-appends the token at runtime (enrich-signature.ts:269); never commit a secret even in a throwaway fixture.

## Shared Patterns

### Dep injection (mock-first / replay)
**Source:** `enrich-signature.ts:204-211` (`EnrichDeps`) + `enrich-signature.test.ts:190-197` (`makeDeps`).
**Apply to:** the kept replay test AND the General-proto bake (inject `watchVideo: () => null`). This is THE seam — both the spike's net-new code and its kept gate hang off it. Zero network when all three deps are stubbed.

### Signature assembly / volatile field
**Source:** `enrich-signature.ts:469-489`.
**Apply to:** `signature-equality.ts` normalization and every equality compare. `provenance.scraped_at` (line 484) is the sole volatile field; everything else is deterministic given identical input + `temp:0 + seed`.

### Standalone-script bootstrap
**Source:** `fold-validate-r1.ts:21-41` (dotenv + tsconfig-paths `register`).
**Apply to:** both `scripts/spike/*.ts` files. Adjust path depth to `../../` (spike/ is nested).

### Test-runner quirk
**Source:** CLAUDE.md / memory / STATE.md — repo-wide.
**Apply to:** every test invocation. `node ./node_modules/vitest/vitest.mjs run <path>`; never `npm test`/`npx vitest`.

## No Analog Found

None. Every file maps to an existing pattern on `main`.

## Metadata

**Analog search scope:** `src/lib/audience/`, `src/lib/audience/__tests__/`, `scripts/`, `src/lib/scraping/`.
**Files scanned:** `enrich-signature.test.ts`, `enrich-signature.ts` (deps + assembly), `fold-validate-r1.ts`, `scripts/` listing, `__tests__/` listing.
**Pattern extraction date:** 2026-06-26
