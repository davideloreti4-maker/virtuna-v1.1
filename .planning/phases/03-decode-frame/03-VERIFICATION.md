---
phase: 03-decode-frame
verified: 2026-06-02T11:20:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live remix decode render — paste a known viral non-owned TikTok URL in Remix mode"
    expected: "Decode frame shows honest 'Decoding structure…' state (no fake skeletons), then renders all 4 beat blocks + non-empty repeatable + non-empty luck lane; completes well under the full ~332s pipeline (~70–100s)"
    why_human: "Requires a running dev server + real Apify resolve + live Omni→Qwen call; latency and live render cannot be verified by grep/unit tests"
  - test: "Permalink reload of the remix row (/analyze/[id])"
    expected: "Decode re-renders from variants.remix.decode (m3 hydration) — does not stay stuck on 'Decoding structure…'"
    why_human: "Requires a persisted overall_score:null row + browser reload; m3 path is unit-tested but live hydration not confirmed this session"
  - test: "Mobile width (<768px) parity + Raycast styling"
    expected: "Same 4 beats + 2 lanes, no truncation; 6% borders, neutral palette (no coral, no warning color on luck lane)"
    why_human: "Visual/responsive appearance — not programmatically verifiable"
---

# Phase 03: Decode Frame Verification Report

**Phase Goal:** For a remix-mode video, the Decode frame renders a structural teardown (hook pattern, pacing/structure, the turn, emotional beat) plus an explicit repeatable-vs-luck split — on its own lightweight Qwen path, never the full ~332s scoring pipeline, and never framing the video as something the user should "fix."
**Verified:** 2026-06-02T11:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | Decode frame renders non-empty structural fields (hook pattern, structure/pacing, the turn, emotional beat) from a dedicated Qwen call in `engine/remix/decode.ts`, persisted to `variants.remix.decode` | ✓ VERIFIED | `decode.ts:65` real `ai.chat.completions.create` Qwen call returning validated 4-beat `DecodeResult`; `DecodeResultZodSchema` enforces `beats.length(4)` (decode-types.ts:119); `runDecodeStream` persists via `persistDecodeToVariants` → `variants.remix.decode` (route.ts:181, 230); frame renders all 4 beats in fixed BEAT_IDS order (DecodeShellNode.tsx:88). 21 engine tests green. |
| 2 | Decode runs on lightweight path (Omni → one Qwen call), NOT `runPredictionPipeline`; does not touch `usage_tracking`/`DAILY_LIMITS` increment; completes well under full pipeline latency (C2) | ✓ VERIFIED | `runDecodeStream` body (route.ts:204-243) contains NO `runPredictionPipeline`/`usage_tracking`/`aggregateScores` (grep confirmed); remix branch early-returns at route.ts:752 BEFORE the score-path pipeline + usage upsert (643/853). DAILY_LIMITS read-to-reject guard (route.ts:400) runs mode-agnostic before the branch; only the increment is skipped. decode-route tests assert pipeline + usage spies never called (11 tests green). Latency = human-verify item. |
| 3 | Explicit repeatable-vs-luck split with a non-empty luck column — never collapsing into "repeatable" (luck-hallucination guard) | ✓ VERIFIED | Zod `luck.min(1)` (decode-types.ts:126) + pure-TS backstop injecting `algorithmic_outlier` (decode.ts:113-119) + prompt mandate "Do NOT collapse everything into repeatable" (decode-prompts.ts:54). Frame renders both lanes "What you can repeat" + "What was luck / timing" with fixed-taxonomy tags (DecodeShellNode.tsx:124,139,145). |
| 4 | Decode never frames the video as something to "fix"; honest teardown of why it worked | ✓ VERIFIED | `DECODE_SYSTEM_PROMPT` forbids advice verbs fix/improve/should/try/consider + mandates third-person, no "you" (decode-prompts.ts:31-32); `buildDecodeContext` omits advice-voiced `improvement_tip` (factors map decode-prompts.ts:112). Component copy literals contain NO advice verbs and no unsanctioned "you" (grep clean). Component + engine no-advice-verb assertions green. |
| 5 | Grade-mode board + existing analyze flow unchanged (no regression) | ✓ VERIFIED | `pipeline.ts` last modified by Phase 01 commits (928a6a05), not Phase 03 — score path untouched. Remix is an early-return ReadableStream keeping score `start()` byte-for-byte identical. route.test.ts (21) + stream-route.test.ts (7) = 28/28 green. Orchestrator broad sweep 505/505 across 52 files. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/remix/decode-types.ts` | DecodeResult/DecodeBeat/LuckCategory + Zod schema (beats.length(4), luck.min(1), enums) | ✓ VERIFIED | All types + `DecodeResultZodSchema` present (130 lines); `.length(4)` + `.min(1)` + `LuckCategoryEnum` confirmed |
| `src/lib/engine/remix/decode-prompts.ts` | DECODE_SYSTEM_PROMPT (honest voice) + buildDecodeContext (omits improvement_tip) | ✓ VERIFIED | Cache-stable prompt with forbidden-verb list + non-empty-luck mandate; improvement_tip omitted from serialization |
| `src/lib/engine/remix/decode.ts` | runDecode Qwen call — temp 0 + seed, single retry, Zod, luck backstop, Sentry S7 | ✓ VERIFIED | All present (decode.ts:74-75 temp 0 + QWEN_SEED, retry loop, backstop:113, Sentry:143) |
| `src/lib/engine/remix/resolve-and-rehost.ts` | resolveAndRehost → {signedUrl, cleanup}, token non-leak, derive-and-drop | ✓ VERIFIED | Token only on server fetch URL (line 70); signedUrl is Supabase signed (96-118); unconditional cleanup remove (123-134); video_storage_path never set |
| `src/app/api/analyze/route.ts` | remix decode branch + persistDecodeToVariants read-merge-write | ✓ VERIFIED | persistDecodeToVariants (161, three-level merge preserving craft/filmstrip), runDecodeStream (204), early-return branch (716-752) |
| `src/components/board/decode/DecodeShellNode.tsx` | 4 beats + 2 lanes + in-flight + error, dual-read | ✓ VERIFIED | 207 lines; DecodedBody/DecodingState/DecodeErrorState; dual-read stream + permalink m3 fallback (168-190); mounted in Board.tsx:516 + BoardMobile.tsx:135 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| route.ts | decode.ts | runDecode(omni) | ✓ WIRED | Imported (route.ts:20), called runDecodeStream:228 |
| route.ts | resolve-and-rehost.ts | resolveAndRehost(tiktok_url) | ✓ WIRED | Imported (18), called :220 |
| decode.ts | qwen/client.ts | getQwenClient + QWEN_SEED | ✓ WIRED | Imported :22, used :49,75 |
| decode.ts | decode-prompts.ts | DECODE_SYSTEM_PROMPT + buildDecodeContext + schema | ✓ WIRED | Imported :25, used :69-70 |
| DecodeShellNode | use-analysis-stream + use-permalink-analysis | dual-read | ✓ WIRED | Both imported + called :168-169 |
| DecodeShellNode | variants.remix.decode | row?.variants?.remix?.decode ?? permalink fallback | ✓ WIRED | :184-189 |
| route complete event | DecodeShellNode | SSE complete { variants:{remix:{decode}} } | ✓ WIRED | route.ts:232-237 emits; frame reads via stream result |
| Board / BoardMobile | DecodeShellNode | layout.id === 'decode' mount | ✓ WIRED | Board.tsx:516, BoardMobile.tsx:135 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| DecodeShellNode | `decode` | useAnalysisStream(SSE) + usePermalinkAnalysis fallback → variants.remix.decode | Yes — fed by real route persist | ✓ FLOWING |
| route runDecodeStream | `decode` | resolveAndRehost → analyzeVideoWithOmni (real) → runDecode (real Qwen create) | Yes — no static return | ✓ FLOWING |
| persistDecodeToVariants | `variants.remix.decode` | read-merge-write from DB row | Yes — preserves sibling craft/filmstrip | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full decode suite | vitest run decode + decode-route + derive-and-drop + DecodeShellNode | 41/41 passed | ✓ PASS |
| Score-path regression (SC#5) | vitest run route.test + stream-route.test | 28/28 passed | ✓ PASS |
| Type safety | tsc --noEmit | exit 0 | ✓ PASS |
| Advice-verb absence in component copy | grep advice verbs / "you" in literals | none | ✓ PASS |
| Live remix render + latency | dev server + real TikTok URL | not run (no server) | ? SKIP → human |

### Probe Execution

No probes — Phase 3 is a feature phase (engine + route + UI), not a migration/tooling phase. No `scripts/*/tests/probe-*.sh` declared in PLAN/SUMMARY. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DECODE-01 | 03-01, 03-02, 03-03 | Structural teardown (4 beats) on lightweight Qwen path, NOT 332s pipeline | ✓ SATISFIED | SC#1 + SC#2 verified — decode.ts engine, route C2 branch, DecodeShellNode 4-beat render |
| DECODE-02 | 03-01, 03-02, 03-03 | Repeatable-vs-luck split (fixed taxonomy), never "fix" the video | ✓ SATISFIED | SC#3 + SC#4 verified — luck.min(1) + backstop + honest-voice prompt + neutral component copy |

No orphaned requirements. REQUIREMENTS.md maps only DECODE-01/DECODE-02 to Phase 3; both claimed by all 3 plans and marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No TBD/FIXME/XXX debt markers in any phase-modified file; no stub returns; no hardcoded empty decode data |

### Human Verification Required

The 03-03 Task 3 live-UAT checkpoint (gate="blocking") was deferred by explicit user decision and replaced with orchestrator static verification (tsc exit 0, eslint exit 0, 41/41 decode + 505/505 broad sweep). Static verification fully covers the component/engine/route contract. The following remain unconfirmed because they require a running dev server + real third-party network calls:

#### 1. Live remix decode render
**Test:** Paste a known viral non-owned TikTok URL in Remix mode.
**Expected:** Honest "Decoding structure…" state (no fake skeletons), then 4 beat blocks + non-empty repeatable + non-empty luck lane; completes ~70–100s (well under ~332s pipeline).
**Why human:** Live Apify resolve + Omni→Qwen call; latency + render only observable at runtime.

#### 2. Permalink m3 hydration on reload
**Test:** Reload `/analyze/[id]` for a remix row (overall_score null).
**Expected:** Decode re-renders from variants.remix.decode; does not stay stuck loading.
**Why human:** Requires persisted row + browser reload; m3 path unit-tested but live hydration unconfirmed.

#### 3. Mobile parity + Raycast styling
**Test:** View at <768px width.
**Expected:** Same 4 beats + 2 lanes, no truncation; 6% borders, neutral palette (no coral/warning on luck).
**Why human:** Visual/responsive appearance not programmatically verifiable.

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria are VERIFIED in the codebase: the decode engine (`decode.ts`) makes a real lightweight Qwen call enforcing exactly 4 beats with honest-absence verdicts and a guaranteed non-empty luck lane; the route remix branch is a true early-return that skips `runPredictionPipeline` and the `usage_tracking` increment while keeping the mode-agnostic DAILY_LIMITS guard (C2); persistence is a sibling-preserving read-merge-write to `variants.remix.decode` with `overall_score` left null (m3); the frame renders all 4 beats + both lanes in honest third-person voice and is mounted in both desktop and mobile boards; and the score path / `pipeline.ts` is byte-for-byte unchanged (SC#5, 28/28 + 505/505 green).

Status is **human_needed** (not passed) solely because three runtime-only checks (live render + latency, live permalink hydration, mobile/visual styling) cannot be confirmed without a running server — these were deferred from the blocking 03-03 Task 3 UAT checkpoint by user decision. No automated check failed; nothing blocks proceeding to Phase 4, which consumes only `variants.remix.decode.repeatable`.

---

_Verified: 2026-06-02T11:20:00Z_
_Verifier: Claude (gsd-verifier)_
