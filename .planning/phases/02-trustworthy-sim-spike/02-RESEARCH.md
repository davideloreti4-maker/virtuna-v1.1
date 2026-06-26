# Phase 2: Trustworthy-SIM Spike - Research

**Researched:** 2026-06-26
**Domain:** Substrate experiment — LLM-bake determinism + provenance + honest tiering (no new stack; in-repo TypeScript/Vitest spike)
**Confidence:** HIGH (all findings verified against substrate code on `main`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Live double-bake (×2) + replay fixture. Freeze ONE Apify scrape, re-run `enrich-signature` **twice** with real Qwen (temp 0 + seed), assert frozen signature JSON is **identical** (normalize volatile fields before compare). Save one bake as a replay fixture. Double (×2, not ×3) is sufficient — determinism is binary.
- **D-01a:** Freeze the scrape. Re-bake from the **same frozen Apify bundle** — Apify = **1 call total**, not ×N.
- **D-01b:** Call budget ~10 Qwen + 1 Apify, <$0.50. Cap omni watch at `MIN_WATCH=3`. Socials control: 3 omni + 1 synth = 4 calls ×2 = 8 Qwen. General bundle: 1 synth ×2 = 2 Qwen. Tests BOTH omni-flash watch AND synthesis determinism.
- **D-02:** General bundle + socials control. Bake a real General evidence bundle (chat `.txt`/doc) through a thin throwaway proto, AND run socials `enrich-signature` on a real `@handle` as known-good control.
- **D-03:** Fold custom context into the provenance leg. A user-supplied "custom context" note is treated as first-class evidence (`source=user`). Prove grounded-vs-ungrounded for BOTH scraped AND user-supplied evidence; confirm custom context strengthens grounding rather than fakes it. Double-bake WITH the note present to confirm determinism holds. Full input+UI+editing is P3.
- **D-04:** Hard 3-gate, all must pass. Determinism: 2/2 bakes identical post-normalization. Provenance: 100% of reactor personas carry ≥1 evidence quote; ungrounded flagged/distinguishable. Tiering: no-calibration SIM resolves Directional by rule (never Validated). Any gate fails → NO-GO + written fallback plan.
- **D-05:** `SPIKE-VERDICT.md` (primary). KEEP the bake + determinism-assertion harness as a committed test (P3's regression foundation). THROW AWAY the proto General-bundle scaffolding.

### Claude's Discretion (resolved in this research)
- Location/shape of the determinism-assertion harness and the throwaway proto General-bundle bake path (test-runner quirk: `node ./node_modules/vitest/vitest.mjs run`, NOT `npm test`/`npx vitest`).
- The normalization rule for the signature-equality compare (volatile vs load-bearing fields).
- The concrete `@handle` for the socials control + the chat/doc for the General bundle (founder may supply; otherwise pick a representative one).
- Where `SPIKE-VERDICT.md` lives + its exact structure.

### Deferred Ideas (OUT OF SCOPE)
- **D-defer-01:** Custom-context full capability (input affordance + UI + editing) → Phase 3.
- General population object (`audiences` generalization, library, badges) → Phase 3 (POP-*, TRUST-01/02).
- Profile verb (build person/panel from uploaded evidence) → Phase 5 (PROF-*).
- Drift re-bake / self-calibration (Directional → Validated promotion) → v2 (CAL-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-03 | A user can build a *trustworthy* General SIM with no calibration data — guaranteed by determinism (temp 0 + seed, bake-once), provenance, and honest trust tiering (de-risked by an early spike per vision §7) | All three legs map to existing substrate: determinism is `temp:0 + QWEN_SEED` in `enrich-signature.ts` (the only non-deterministic field is `provenance.scraped_at`); provenance is `SignaturePersona.evidence` + `SignatureProvenance`; tiering is a *rule* over `DomainPack.calibration` (no resolver exists yet — the spike asserts the rule, P3 builds the resolver per TRUST-01). |
</phase_requirements>

## Summary

This is a **spike**, not a build phase. The substrate it interrogates is already on `main` and fully mapped below. The three trust legs are not new code to write — they are *properties to verify* on existing machinery:

- **Determinism** already exists: every LLM call in `enrich-signature.ts` runs `temperature: 0, seed: QWEN_SEED` (omni watch at line 297-298, synthesis at line 350-351). The engine-fill (temperature/disposition from `TEMPERATURE_DISPOSITION`) and the pure `predictedSignature()` in `signature.ts` are deterministic by construction. **The single non-deterministic field in the entire `AudienceSignature` is `provenance.scraped_at = new Date().toISOString()` (enrich-signature.ts:484)** — this is the whole normalization story.
- **Provenance** already exists: each `SignaturePersona` carries an `evidence: string` (audience-types.ts:127), and the bake records a `SignatureProvenance` block (handle, scraped_at, videos_analyzed/watched, sub_coverage). The spike *inspects* these; it adds a throwaway `source=user` custom-context tag for D-03.
- **Tiering** does NOT exist as code yet (verified: no Validated/Directional resolver anywhere in `src/lib`). It is a **rule** over `DomainPack.calibration` — Socials has a populated `CalibrationSpec` (`baselineRef → calibration-baseline.json`, 26 KB, present) making it the **Validated** anchor; a no-calibration General SIM has no calibration set → **Directional by rule**. The spike asserts the rule as a pure predicate; P3 (TRUST-01) builds the badge resolver.

**Primary recommendation:** Two artifacts. (1) A **throwaway live probe** at `scripts/spike/trustworthy-sim-probe.ts` that does the real ×2 double-bake against frozen inputs (live Qwen + 1 Apify scrape), the General-bundle proto bake, and emits verdict evidence. (2) A **kept Vitest regression test** at `src/lib/audience/__tests__/signature-determinism.test.ts` that replays the saved fixture with mocked deps (zero network) and proves the equality-harness + normalization + assembly determinism — this is P3's free-by-construction gate. `SPIKE-VERDICT.md` lives in the phase dir.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Double-bake live probe (LLM determinism) | Script/CLI harness (`scripts/spike/`) | — | Hits real DashScope ×2 + 1 Apify; run once manually; throwaway per D-05. Not a CI unit test (network + cost). |
| Determinism regression gate (assembly + normalization) | Test tier (`src/lib/audience/__tests__/`) | — | Replays recorded fixture via injected `EnrichDeps`; zero network; kept as P3 foundation per D-05. |
| General-bundle proto bake | Script/CLI harness (`scripts/spike/`) | enrich-signature `synthesize` dep | Thin text→`EnrichInput` adapter + omni-skip; the only net-new code, thrown away per D-05. |
| Provenance inspection | Script/CLI harness + assertions | `SignaturePersona.evidence`, `SignatureProvenance` | Pure read over baked signature; no infra. |
| Tiering rule assertion | Pure predicate (in probe + verdict doc) | `DomainPack.calibration` | No resolver exists; the spike asserts `hasCalibrationSet ? Validated : Directional`. |
| Verdict | Doc (`SPIKE-VERDICT.md`) | — | The primary deliverable; per-leg result + go/no-go + fallback. |

## Standard Stack

No new packages. This spike is entirely in-repo, using machinery already present.

### Core (existing — reuse, do not add)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `src/lib/audience/enrich-signature.ts` | The bake "heart" — `enrichSignature(input, deps?)`. The function the double-bake invokes ×2. | The only bake path; already dep-injectable (omni watch / subtitle fetch / synthesize). [VERIFIED: read on `main`] |
| `src/lib/audience/calibration.ts` | `calibrateFromScrape(input, deps?)` orchestration — scrape → enrich → frozen signature on row. | Where the socials-control bake is normally driven; the spike can call `enrichSignature` directly to skip the scrape orchestration once the bundle is frozen. [VERIFIED] |
| `src/lib/audience/audience-types.ts` | `AudienceSignature`, `SignaturePersona`, `SignatureProvenance`, `GoalIntent`. | The provenance/equality leg inspects these exact shapes. [VERIFIED] |
| `src/lib/engine/qwen/client.ts` | `QWEN_SEED=7`, `QWEN_OMNI_MODEL=qwen3.5-omni-flash`, `QWEN_REASONING_MODEL=qwen3.7-plus`. | The determinism config under test. [VERIFIED] |
| `src/lib/engine/domain-pack.ts` + `src/lib/engine/packs/socials.ts` | `DomainPack.calibration` (`CalibrationSpec`) — the tiering basis. | Socials = populated `calibration` (Validated); General = none (Directional). [VERIFIED] |
| `vitest` (`node ./node_modules/vitest/vitest.mjs run`) | Test runner for the kept regression gate. | Already installed (`node_modules/vitest/vitest.mjs` present). [VERIFIED: filesystem] |

### Supporting (existing)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/scraping/apify-provider.ts` `scrapeProfileBundle(handle, limit=12)` | The single Apify scrape (D-01a). Returns `ProfileBundle` (profile + videos + subCoverage). | Called ONCE in the live probe; output frozen to a JSON fixture and reused for both bakes. [VERIFIED] |
| `src/lib/audience/temperature-disposition.ts` `TEMPERATURE_DISPOSITION` | Engine-fill map (archetype → temperature/disposition). | Deterministic by construction; the bake reads it, never the LLM. [VERIFIED] |
| `src/lib/scraping/types.ts` `VideoData`, `ProfileData`, `ProfileBundle` | The shapes the frozen fixture serializes; the General adapter maps text into `VideoData[]`. | The proto bundle adapter targets these. [VERIFIED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Calling `enrichSignature` directly in the probe | Driving via `calibrateFromScrape` | `calibrateFromScrape` re-scrapes Apify on each call (would violate D-01a — Apify drift). Freeze the bundle once, then call `enrichSignature` directly with the frozen `EnrichInput`. |
| Throwaway script for the live probe | A Vitest test hitting live Qwen | Live network + $ cost in a unit test is brittle and pollutes CI. Keep the LIVE probe as a one-shot script; keep only the *replay* test in Vitest (D-05). |
| Recording LLM outputs via injected `synthesize`/`watchVideo` deps for the kept test | Recording raw HTTP | Dep injection already exists (`EnrichDeps`) — record the `WatchNote[]` + `SynthSchema` output once from the live bake, replay them as mock deps. Zero new infra. |

**Installation:** None. Confirm env at probe time:
```bash
# Live probe requires (both already used by the substrate):
#   DASHSCOPE_API_KEY  — real Qwen (omni-flash + 3.7-plus)
#   APIFY_TOKEN        — the 1 scrape + mp4 token append (prepareWatchUrl)
node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts
```

## Package Legitimacy Audit

**Not applicable — this phase installs ZERO external packages.** All work uses modules already on `main` (`enrich-signature`, `calibration`, `audience-types`, `qwen/client`, `domain-pack`, `apify-provider`) and the already-installed `vitest`. No registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  LIVE PROBE  scripts/spike/                  │
                          │  trustworthy-sim-probe.ts  (THROWAWAY, D-05) │
                          └─────────────────────────────────────────────┘
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            │ (1) SOCIALS CONTROL            │ (2) GENERAL BUNDLE PROTO       │ (3) TIERING
            ▼                                ▼                                ▼
  ApifyProvider.scrapeProfileBundle    chat .txt / doc + custom-context     DomainPack.calibration
   (@handle)  ── 1 Apify call ──┐       note (source=user)                  │
                                ▼                │                          ▼
                  FREEZE → bundle.fixture.json   ▼                  hasCalibrationSet?
                                │        chatBundleToEnrichInput(text, note)  ── no ──▶ "Directional"
            ┌───────────────────┤        (THROWAWAY adapter)         (Socials baselineRef present
            │                   │                │                    ──▶ "Validated"; General none
   bake A   ▼          bake B   ▼                ▼                    ──▶ "Directional" by rule)
  enrichSignature   enrichSignature      enrichSignature(input,
  (frozen input,    (frozen input,        {watchVideo: ()=>null})  ← 0 omni, 1 synth ×2
   real Qwen)        real Qwen)           ── 2 Qwen ──┐
   3 omni+1 synth    3 omni+1 synth                   │
        │                  │                          ▼
        ▼                  ▼                   AudienceSignature (General proto)
   AudienceSignature  AudienceSignature              │
        │                  │                         ▼
        ▼                  ▼              PROVENANCE LEG: inspect persona.evidence
   normalizeSignature(A) === normalizeSignature(B) ? │  + SignatureProvenance + source=user tag
   (strip provenance.scraped_at)                     │
        │                                            │
        └──────────────┬─────────────────────────────┘
                       ▼
            DETERMINISM GATE  +  PROVENANCE GATE  +  TIERING GATE
                       │
                       ▼
            ┌──────────────────────────────┐     ┌──────────────────────────────────┐
            │  SPIKE-VERDICT.md  (PRIMARY)  │     │  KEPT: signature-determinism.test │
            │  per-leg + GO/NO-GO + fallback│     │  replays bundle.fixture + recorded│
            └──────────────────────────────┘     │  LLM outputs via mock deps (0 net)│
                                                  └──────────────────────────────────┘
```

### Recommended Project Structure
```
scripts/spike/                              # THROWAWAY (D-05) — deleted after verdict
├── trustworthy-sim-probe.ts                #   live ×2 double-bake + general proto + tiering
├── chat-bundle-adapter.ts                  #   text → EnrichInput (the only net-new logic)
└── fixtures/
    └── socials-bundle.fixture.json         #   the 1 frozen Apify scrape (D-01a)

src/lib/audience/
├── signature-equality.ts                   # KEEP — normalizeSignature() + signatureEqual()
└── __tests__/
    ├── signature-determinism.test.ts       # KEEP — replay gate, zero network (P3 foundation)
    └── fixtures/
        ├── bake-input.fixture.json         # KEEP — frozen EnrichInput
        └── bake-llm-outputs.fixture.json   # KEEP — recorded WatchNote[] + SynthSchema

.planning/phases/02-trustworthy-sim-spike/
└── SPIKE-VERDICT.md                        # PRIMARY deliverable
```
> Per `./CLAUDE.md`: never write working files/tests to the repo root. Scripts → `scripts/`, tests → co-located `__tests__/`, the verdict → the phase planning dir.

### Pattern 1: Freeze-once, bake-twice (D-01 / D-01a)
**What:** Scrape Apify exactly once, serialize the `ProfileBundle` (or the assembled `EnrichInput`) to JSON, then drive `enrichSignature` twice from that frozen input.
**When to use:** The determinism probe. Re-scraping per bake lets Apify drift corrupt the test.
**Example:**
```typescript
// Source: src/lib/audience/enrich-signature.ts:382 (verified signature) + apify-provider.ts:274
// scripts/spike/trustworthy-sim-probe.ts  (THROWAWAY)
import { enrichSignature, type EnrichInput } from "@/lib/audience/enrich-signature";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { normalizeSignature } from "@/lib/audience/signature-equality"; // KEEP module

// (1) ONE Apify call — then freeze.  D-01a.
const bundle = await new ApifyScrapingProvider().scrapeProfileBundle("<@handle>", 12);
const input: EnrichInput = {
  handle: "<@handle>", profile: bundle.profile, videos: bundle.videos,
  subCoverage: bundle.subCoverage, goalIntent: "grow",
};
writeFileSync("scripts/spike/fixtures/socials-bundle.fixture.json", JSON.stringify(input));

// (2) bake TWICE from the SAME frozen input, REAL Qwen (temp 0 + seed inside enrichSignature).
const a = await enrichSignature(input);   // 3 omni + 1 synth
const b = await enrichSignature(input);   // 3 omni + 1 synth   → 8 Qwen total
const identical = JSON.stringify(normalizeSignature(a)) === JSON.stringify(normalizeSignature(b));
```

### Pattern 2: Signature normalization (the equality rule)
**What:** Strip the one volatile field before byte-compare. `provenance.scraped_at` is `new Date().toISOString()` set at assembly time (enrich-signature.ts:484) — it differs every bake. Everything else is deterministic given identical input + `temp:0 + seed`.
**When to use:** Every signature equality check (probe + kept test).
**Example:**
```typescript
// Source: enrich-signature.ts:469-489 (signature assembly) + audience-types.ts:151-173
// src/lib/audience/signature-equality.ts  (KEEP — P3 regression foundation)
import type { AudienceSignature } from "./audience-types";

const FROZEN_TS = "1970-01-01T00:00:00.000Z";

/** Zero the only non-deterministic field; deep-sort keys so serialization is stable. */
export function normalizeSignature(sig: AudienceSignature): AudienceSignature {
  return {
    ...sig,
    provenance: { ...sig.provenance, scraped_at: FROZEN_TS }, // ← the ONLY volatile field
  };
}

export function signatureEqual(a: AudienceSignature, b: AudienceSignature): boolean {
  return stableStringify(normalizeSignature(a)) === stableStringify(normalizeSignature(b));
}
// stableStringify = JSON.stringify with recursively sorted object keys (guards key-order drift).
```
**Volatile vs load-bearing (verified against the types):**
| Field | Volatile? | Why |
|-------|-----------|-----|
| `provenance.scraped_at` | **VOLATILE** | `new Date().toISOString()` per bake (enrich-signature.ts:484). The only one. |
| `provenance.handle / videos_analyzed / videos_watched / sub_coverage` | Load-bearing | Deterministic from the frozen input. (`videos_watched` is deterministic only if the same omni calls succeed — see Pitfall 2.) |
| `creator_persona.*` (4 fields) | Load-bearing | LLM output under `temp:0+seed`; must match. |
| `audience.personas[].{archetype,share,temperature,disposition,reaction_frame,evidence}` | Load-bearing | Core of the SIM. `temperature/disposition` engine-filled (always identical); the rest LLM-derived. |
| `audience.persona_weights / temperature_mix / interest_tags / what_resonates / what_falls_flat / maturity / follower_tier` | Load-bearing | LLM-derived; must match. |
| `summary` | Load-bearing | LLM-derived; must match. |
> No `id`/UUID/timestamp fields exist on `AudienceSignature` itself (those live on the `Audience` row, which the spike never persists). So normalization is genuinely a one-field strip.

### Pattern 3: General-bundle proto bake (the only net-new code, D-02/D-05)
**What:** Feed a text chat/doc bundle into the **synthesis step** without the omni video watch. The seam is `enrich-signature.ts:454` (`const synth = await synthesize(payload)`). Reuse the entire real synthesis + engine-fill + provenance path by mapping text into `VideoData[]` and injecting `watchVideo: () => null` so zero omni calls fire.
**When to use:** The General no-calibration case the spike exists to de-risk.
**Example:**
```typescript
// scripts/spike/chat-bundle-adapter.ts  (THROWAWAY, D-05)
import type { EnrichInput } from "@/lib/audience/enrich-signature";
import type { VideoData, ProfileData } from "@/lib/scraping/types";

/** Map a chat/doc + optional source=user note into an EnrichInput. No video, no omni. */
export function chatBundleToEnrichInput(text: string, customNote?: string): EnrichInput {
  // Pack the evidence into caption/subtitleText — the synth payload reads these (enrich:433-449).
  const evidence = customNote ? `${text}\n\n[custom-context · source=user] ${customNote}` : text;
  const videos: VideoData[] = [{
    platformVideoId: "general-proto-0", videoUrl: "", caption: evidence.slice(0, 4000),
    views: 1, likes: 0, comments: 0, shares: 0, saves: 0, hashtags: [],
    durationSeconds: 0, postedAt: new Date(0),
    // NO mediaUrl → prepareWatchUrl never runs; watchVideo stubbed to null anyway.
  }];
  const profile: ProfileData = {
    handle: "general-proto", displayName: "General Proto", bio: "", avatarUrl: "",
    verified: false, followerCount: 0, followingCount: 0, heartCount: 0, videoCount: 1,
  };
  return { handle: "general-proto", profile, videos, subCoverage: "0/0", goalIntent: "grow" };
}

// In the probe:  enrichSignature(input, { watchVideo: async () => null })  → 0 omni, 1 synth.
```
> Why this is minimal: it reuses `enrichSignature`'s real `defaultSynthesize` (same `temp:0+seed`, same `SynthSchema` validation), so the General bake exercises the genuine synthesis-determinism property — only the *input adapter* is throwaway. For the `source=user` first-class tag, post-process the returned signature in the probe (e.g. set `provenance.custom_context = { source: "user", note }`) and assert at least one persona's `evidence` references the note text.

### Anti-Patterns to Avoid
- **Re-scraping per bake.** Violates D-01a — Apify drift (new videos, changed counts) corrupts the equality test. Freeze once.
- **Hitting live Qwen inside a kept Vitest test.** Network + $ + flakiness in CI. The kept test replays recorded deps; only the throwaway script goes live.
- **Conflating `Audience.calibration` with trust calibration.** `Audience.calibration` (audience-types.ts:227, `{source: "scrape"|"description"}`) is *scrape provenance*, NOT the Validated/Directional calibration set. Trust tiering keys off `DomainPack.calibration` (`CalibrationSpec`). Do not read the wrong field.
- **Building a tiering resolver in the spike.** No resolver exists; the spike *asserts the rule*. The badge resolver is P3 (TRUST-01). Over-building here breaks D-05 scope.
- **Comparing un-normalized signatures.** Will always fail on `scraped_at`. Normalize first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Run the bake | A new bake function | `enrichSignature(input, deps?)` | It already does omni-watch → synth → engine-fill → provenance, all `temp:0+seed`, all dep-injectable. |
| Mock the LLM for the kept test | HTTP-level recording | `EnrichDeps` (`watchVideo`/`fetchSubtitle`/`synthesize`) | Dep injection is built in (enrich-signature.ts:204-211) and already used by the existing test. |
| Scrape | A new Apify call path | `ApifyScrapingProvider().scrapeProfileBundle` | The §P 1-scrape collapse; one call returns profile+videos+subs. |
| Determinism config | New seed/temp plumbing | `QWEN_SEED`, `temperature:0` (already in the bake) | The substrate is already wired for reproducibility. |
| Tiering | A badge component/resolver | A pure predicate over `DomainPack.calibration` | Spike asserts the rule; P3 builds the UI/resolver. |

**Key insight:** This spike writes almost no production code. The one genuinely new artifact that *survives* is `signature-equality.ts` (`normalizeSignature` + `signatureEqual`) plus its replay test — and that exists precisely because P3 needs a regression gate. Everything else is either reused (`enrichSignature`) or thrown away (`scripts/spike/*`).

## Runtime State Inventory

> Not a rename/refactor/migration phase. This section is light by design — the spike persists nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the spike never calls `createAudience`/persists a row. Bakes live in memory + JSON fixtures under `scripts/spike/fixtures/` and `__tests__/fixtures/`. | None |
| Live service config | None changed. Live probe *reads* DashScope + Apify (1 scrape, ~10 Qwen). No config mutated. | None |
| OS-registered state | None. | None |
| Secrets/env vars | Reads `DASHSCOPE_API_KEY` + `APIFY_TOKEN` (existing). No new keys. `prepareWatchUrl` appends `APIFY_TOKEN` to the mp4 URL (enrich-signature.ts:269). | Confirm both present before the live probe |
| Build artifacts | `scripts/spike/*` is throwaway (D-05) — delete after the verdict. The kept test + `signature-equality.ts` compile into the normal build. | Delete `scripts/spike/` on close |

## Common Pitfalls

### Pitfall 1: Forgetting `provenance.scraped_at` makes raw compares always fail
**What goes wrong:** Two identical bakes report "NOT identical" because `scraped_at` differs by milliseconds.
**Why it happens:** enrich-signature.ts:484 sets `scraped_at: new Date().toISOString()` at assembly time, independent of input.
**How to avoid:** Always run through `normalizeSignature` before compare. It is the entire normalization rule.
**Warning signs:** A diff whose only delta is the `scraped_at` string.

### Pitfall 2: Omni watch failures degrade gracefully → non-deterministic `videos_watched`
**What goes wrong:** A flaky omni call returns `null` on one bake but not the other; `watchNotes` length differs, `videos_watched` differs, and the synthesis payload differs → bakes diverge for a *transport* reason, not an LLM-determinism reason.
**Why it happens:** `defaultWatchVideo` catches errors and returns `null` (enrich-signature.ts:311-316); failures are filtered (line 411). This is correct production behavior but adds an availability variable to the live probe.
**How to avoid:** In the live probe, treat a watch-count mismatch as **inconclusive, not a determinism failure** — re-run, or pin the watched set. The kept replay test uses recorded `watchVideo` deps so it is immune. Document any live mismatch in the verdict as a transport caveat.
**Warning signs:** `provenance.videos_watched` differs between A and B while everything else matches.

### Pitfall 3: Thinking-mode residual nondeterminism in the synthesis call
**What goes wrong:** The synthesis call runs `enable_thinking: true, thinking_budget: 2000` (enrich-signature.ts:352-353). Thinking-mode stages are the documented residual-jitter source `QWEN_SEED` exists to pin (qwen/client.ts:22-27).
**Why it happens:** Greedy decoding (`temp:0`) is the primary lever; the seed pins the rest. If the model provider ignores the seed under thinking mode, output could drift.
**How to avoid:** This is *exactly* the make-or-break property the live double-bake exists to test (D-01b explicitly keeps the synth in scope). If A≠B on load-bearing fields, that IS the NO-GO signal — capture the diff in the verdict + fallback (e.g. disable thinking for the bake, or pin further).
**Warning signs:** `creator_persona`/`summary`/`reaction_frame` prose differs between bakes despite identical input.

### Pitfall 4: Test-runner reports fake PASS(0)
**What goes wrong:** `npm test` / `npx vitest` print `PASS (0)` / `FAIL (0)` — a known shim bug in this repo.
**Why it happens:** Repo quirk (recorded in STATE.md Plan 01-01 + CLAUDE.md/memory).
**How to avoid:** Run `node ./node_modules/vitest/vitest.mjs run <path>` always. Verified the binary exists at that path.
**Warning signs:** A green run reporting zero tests executed.

### Pitfall 5: Treating an empty `evidence` string as "grounded"
**What goes wrong:** `RawPersonaSchema.evidence` defaults to `""` (enrich-signature.ts:100). A persona with empty evidence is *ungrounded* but won't crash anything.
**Why it happens:** The schema permits empty evidence for graceful degradation.
**How to avoid:** The provenance gate (D-04) must assert `evidence.trim().length > 0` for 100% of the 10 reactors AND that ungrounded ones (empty/generic) are *distinguishable*. This is the precise pass-bar — an empty-evidence persona means the provenance leg FAILS for that SIM.
**Warning signs:** A persona whose `evidence` is `""` or a generic non-quote.

## Code Examples

### Kept regression test (replay, zero network)
```typescript
// Source: pattern mirrors existing src/lib/audience/__tests__/enrich-signature.test.ts:190-197
// src/lib/audience/__tests__/signature-determinism.test.ts  (KEEP — P3 foundation)
import { describe, it, expect } from "vitest";
import { enrichSignature, type EnrichDeps } from "../enrich-signature";
import { signatureEqual, normalizeSignature } from "../signature-equality";
import input from "./fixtures/bake-input.fixture.json";
import recorded from "./fixtures/bake-llm-outputs.fixture.json"; // {watchNotes, synth} from the LIVE bake

const replayDeps: EnrichDeps = {
  watchVideo: async () => recorded.watchNotes[0],   // recorded omni output
  fetchSubtitle: async () => recorded.subtitle ?? null,
  synthesize: async () => recorded.synth,           // recorded synth output
};

describe("signature determinism (replay gate)", () => {
  it("two assemblies from identical inputs+LLM outputs are byte-identical post-normalization", async () => {
    const a = await enrichSignature(input as any, replayDeps);
    const b = await enrichSignature(input as any, replayDeps);
    expect(signatureEqual(a, b)).toBe(true);
  });
  it("the ONLY field that differs pre-normalization is provenance.scraped_at", async () => {
    const a = await enrichSignature(input as any, replayDeps);
    const b = await enrichSignature(input as any, replayDeps);
    expect(a.provenance.scraped_at).not.toBe(b.provenance.scraped_at); // proves it IS volatile
    expect(normalizeSignature(a)).toEqual(normalizeSignature(b));      // and normalization fixes it
  });
});
```

### Tiering rule assertion (pure predicate)
```typescript
// Source: domain-pack.ts:106-109 (CalibrationSpec) + packs/socials.ts:67-70 (populated)
// in the probe + asserted in SPIKE-VERDICT.md
type TrustTier = "Validated" | "Directional";

/** A SIM is Validated iff its pack carries a non-empty calibration set; else Directional. */
function resolveTier(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}
// Socials pack:  resolveTier(SOCIALS_PACK.calibration) === "Validated"   (baseline-baseline.json present)
// General SIM :  resolveTier(undefined)               === "Directional"  (no calibration set) ← by rule
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Constant `deriveAudienceProfile` + static `repaintPersonas` | Scrape-derived frozen `AudienceSignature` (bake-once, temp 0 + seed) | engine-rework (on `main`) | The SIM primitive the spike tests already exists. |
| 3-model stack incl. `qwen3.6-flash` | 2-model stack: `qwen3.5-omni-flash` (sensor) + `qwen3.7-plus` (everything) | 2026-06-25 (R1′) | The two determinism configs the double-bake exercises. |
| Byte-identical golden-master gate (PACK-04) | Light smoke/structural gate (Phase 1 D-02/D-03) | Phase 1 | The spike adds its OWN equality gate for the *signature*, distinct from the relaxed scoring gate. |

**Deprecated/outdated:**
- `QWEN_FAST_MODEL` (`qwen3.6-flash`) — RETIRED 2026-06-25; do not reference.
- Validated/Directional badge resolver — does NOT exist yet; do not assume one. It is P3 (TRUST-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `provenance.scraped_at` is the ONLY non-deterministic field in `AudienceSignature` | Pattern 2 | If another volatile field exists (e.g. provider-side ordering), the probe falsely reports NO-GO. Mitigation: the probe should diff the FULL un-normalized pair and log every differing path, not just assert — surfaces any surprise field. [VERIFIED by reading all of enrich-signature.ts assembly + audience-types.ts; risk is low but the probe self-checks.] |
| A2 | DashScope honors `seed` under `enable_thinking:true` for the synth call | Pitfall 3 | This is the make-or-break unknown — the spike EXISTS to test it. Not an assumption to confirm; it is the experiment. |
| A3 | Mapping chat text into `VideoData.caption` produces a usable synth payload (the General proto) | Pattern 3 | If the synth prompt (SYNTH_SYSTEM, tuned for engagement ratios) produces garbage on text-only input, the General bake may not yield a representative signature. Mitigation: the socials control (D-02) anchors comparison; a weak General bake is itself a verdict input, not a harness bug. |
| A4 | `@handle` and the chat/doc bundle | Discretion | Founder may supply. If not, pick a representative public TikTok handle with ≥10 videos (so `isThin` is false) and a synthetic ~20-message chat `.txt`. Low risk — both are test inputs, swappable. |

**If founder supplies the `@handle` + chat bundle, A4 resolves to a locked decision; otherwise the planner picks per the guidance above.**

## Open Questions (RESOLVED)

> Q1 is the spike's core experiment (un-pre-answerable by design — answered by the 02-02 live probe; result recorded in SPIKE-VERDICT.md). Q2/Q3 have adopted recommendations: default handle + synthetic chat `.txt` in 02-02; probe-local `provenance.custom_context` (`source=user`) shape in 02-02/02-03. No blocking unknowns remain for planning.

1. **Does thinking-mode synthesis stay deterministic across bakes?**
   - What we know: `temp:0 + seed:7` is set; seed exists specifically to pin thinking-mode jitter.
   - What's unclear: whether the provider actually honors it for `qwen3.7-plus` thinking mode.
   - Recommendation: this is the spike's core experiment (Pitfall 3) — don't pre-answer; capture the diff in the verdict.

2. **Concrete `@handle` + General chat/doc bundle.**
   - What we know: must be a non-thin handle (≥10 videos) so the socials control bakes a full signature.
   - What's unclear: founder's preference.
   - Recommendation: ask founder; default to a representative public handle + a ~20-message synthetic chat `.txt` if none supplied.

3. **Where the `source=user` tag attaches structurally (provenance vs per-evidence).**
   - What we know: `SignatureProvenance` has no `custom_context` field today; `SignaturePersona.evidence` is a free string.
   - What's unclear: the eventual P3 shape.
   - Recommendation: the spike models it minimally (probe-local `provenance.custom_context = {source,note}` + assert persona evidence references the note). The real field lands in P3 (D-defer-01). Note the recommendation in the verdict.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vitest` runner | Kept replay test | ✓ | `node_modules/vitest/vitest.mjs` present | — (run via `node ./node_modules/vitest/vitest.mjs run`) |
| `DASHSCOPE_API_KEY` | Live probe (real Qwen ×~10) | ✗ verify at runtime | env | None — without it the live double-bake cannot run (the make-or-break test). Probe must fail loudly if absent. |
| `APIFY_TOKEN` | Live probe (1 scrape + mp4 token) | ✗ verify at runtime | env | None for the scrape; but if a frozen `socials-bundle.fixture.json` already exists, the probe can skip the scrape and re-bake from the fixture (still needs DashScope). |

**Missing dependencies with no fallback:**
- `DASHSCOPE_API_KEY` — blocks the live double-bake. The probe is the experiment; planner must add an env-check guard that fails clearly.

**Missing dependencies with fallback:**
- `APIFY_TOKEN` — only needed for the one fresh scrape; a pre-frozen bundle fixture removes the dependency for re-runs.

## Validation Architecture

> nyquist_validation = true → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed; run via `node ./node_modules/vitest/vitest.mjs run`) |
| Config file | repo Vitest config (existing; engine suite is green per STATE.md: 95 files / 1170 passed) |
| Quick run command | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts` |
| Full suite command | `node ./node_modules/vitest/vitest.mjs run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-03 (determinism, assembly) | Two bakes from identical inputs+LLM outputs are byte-identical post-normalization | unit (replay) | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts` | ❌ Wave 0 |
| TRUST-03 (normalization) | `scraped_at` is the only pre-normalization delta | unit | same file | ❌ Wave 0 |
| TRUST-03 (LLM determinism) | Real ×2 double-bake identical on load-bearing fields | manual (live script) | `node --import tsx scripts/spike/trustworthy-sim-probe.ts` (throwaway) | ❌ Wave 0 |
| TRUST-03 (provenance) | 100% reactors carry ≥1 evidence quote; ungrounded distinguishable (scraped + user-supplied) | manual (probe assertions) + verdict | (in probe) | ❌ Wave 0 |
| TRUST-03 (tiering) | No-calibration SIM resolves Directional by rule | unit (pure predicate) | can live in the kept test file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts`
- **Per wave merge:** `node ./node_modules/vitest/vitest.mjs run src/lib/audience` (audience suite)
- **Phase gate:** full suite green + `SPIKE-VERDICT.md` written with a GO/NO-GO.

### Wave 0 Gaps
- [ ] `src/lib/audience/signature-equality.ts` — `normalizeSignature` + `signatureEqual` (KEEP)
- [ ] `src/lib/audience/__tests__/signature-determinism.test.ts` — replay gate (KEEP)
- [ ] `src/lib/audience/__tests__/fixtures/bake-input.fixture.json` + `bake-llm-outputs.fixture.json` — recorded from the live bake
- [ ] `scripts/spike/trustworthy-sim-probe.ts` + `chat-bundle-adapter.ts` + `fixtures/socials-bundle.fixture.json` (THROWAWAY)
- Framework install: none — Vitest present.

## Security Domain

> `security_enforcement` absent in config → treated as enabled. This spike adds no new attack surface (no routes, no auth, no user-input boundary in production code), so the section is intentionally light.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Spike adds no auth surface. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No new endpoints; nothing persisted. |
| V5 Input Validation | partial | The General proto feeds free text into `SynthSchema` (Zod-validated, enrich-signature.ts:357). The bundle text is test-controlled, not end-user. |
| V6 Cryptography | no | None. |
| V10 Malicious Code / SSRF | yes | The mp4 watch URL passes `prepareWatchUrl` SSRF allowlist (enrich-signature.ts:258-274) — already enforced; the spike reuses it unchanged. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage (DASHSCOPE_API_KEY / APIFY_TOKEN in fixtures) | Information disclosure | NEVER serialize tokens into `scripts/spike/fixtures/*.json`. `prepareWatchUrl` appends `APIFY_TOKEN` to mp4 URLs at runtime — strip query strings from any `mediaUrl` before freezing the bundle fixture (per `./CLAUDE.md`: never commit secrets). |
| SSRF via scraped mp4 URL | Tampering | Already mitigated — `prepareWatchUrl` HTTPS + host allowlist; reused as-is. |

> **Action for the planner:** add a task note to scrub `APIFY_TOKEN`/query strings from any frozen `mediaUrl` in `socials-bundle.fixture.json` before it is written, so no secret lands in a committed (even throwaway) fixture.

## Sources

### Primary (HIGH confidence — read on `main` this session)
- `src/lib/audience/enrich-signature.ts` — bake heart; `enrichSignature` signature, deps, `temp:0+seed`, the `scraped_at` volatile field, the `synthesize` seam (line 454).
- `src/lib/audience/calibration.ts` — `calibrateFromScrape` orchestration; `Audience.calibration` (scrape provenance, NOT trust tier).
- `src/lib/audience/audience-types.ts` — `AudienceSignature`/`SignaturePersona`/`SignatureProvenance`/`GoalIntent` shapes.
- `src/lib/flywheel/signature.ts` — `predictedSignature()` pure/deterministic-by-construction half.
- `src/lib/engine/qwen/client.ts` — `QWEN_SEED=7`, model constants, seed rationale.
- `src/lib/engine/domain-pack.ts` + `src/lib/engine/packs/socials.ts` — `CalibrationSpec`; Socials = populated (Validated anchor).
- `src/lib/audience/__tests__/enrich-signature.test.ts` — the dep-injection test pattern the replay gate mirrors.
- `src/lib/scraping/types.ts` + `apify-provider.ts` — `ProfileBundle`/`VideoData`; `scrapeProfileBundle`.
- `.planning/NUMEN-GSI-VISION.md` §3/§6/§7 — two-tier model, verified architecture, the make-or-break question.
- `.planning/phases/02-trustworthy-sim-spike/02-CONTEXT.md` — locked decisions D-01..D-05.
- Filesystem: `node_modules/vitest/vitest.mjs` present; `src/lib/engine/calibration-baseline.json` present (26 KB); confirmed NO Validated/Directional resolver in `src/lib` (grep).

### Secondary (MEDIUM)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — phase framing, TRUST-03, success criteria.

### Tertiary (LOW)
- None — all claims verified against code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is in-repo and read directly.
- Architecture (harness/proto/tiering shape): HIGH — the seam (`synthesize` at line 454), the volatile field (`scraped_at` at line 484), and the tiering basis (`DomainPack.calibration`) are all verified.
- Pitfalls: HIGH — derived from the actual code paths (graceful watch degradation, thinking mode, the `npm test` shim quirk).
- The one genuine unknown (thinking-mode seed determinism) is the experiment itself, not a research gap.

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable substrate; the only churn risk is the engine model defaults in `qwen/client.ts`)
