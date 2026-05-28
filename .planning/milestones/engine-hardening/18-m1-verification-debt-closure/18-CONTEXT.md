# Phase 18: M1 Verification Debt Closure - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all M1 Engine Foundation verification debt so the v3.0.0 pipeline can ship behind a polished UX without quiet bypasses. Two tracks:

1. **VERIF code fixes (VERIF-04):** Five code-review follow-ups (WR-04, WR-05, IN-01, IN-02, IN-03). WR-04 and WR-05 are already implemented — plan verifies and closes them. IN-01/IN-02/IN-03 require new code.

2. **VERIF live UAT/smoke (VERIF-01/02/03):** Three deferred verification items from Phases 2/3/4 that required a live Vercel deploy. Plan generates manual test scripts; user executes against live deploy and records pass/fail.

**Key live-state findings that compress scope:**
- **WR-04 already done:** `calculate-trends/route.ts:208–228` has the bulk-prefetch `Set<string>` with graceful fallback implemented during M1. Verify + close.
- **WR-05 already done:** `audio_description` Zod bounds fixed to `min(10).max(280)` in both `src/lib/engine/types.ts:375` (comment cites "06-REVIEW.md WR-05 — was min(1).max(300)") and `src/lib/engine/qwen/schemas.ts:77`. Verify + close.
- **IN-01 dead reference:** `gemini.ts` / `analyzeVideoWithGemini` no longer exist — replaced by `analyzeVideoWithOmni` in `qwen/omni-analysis.ts` during M1. The Qwen video-analysis path is already correct (clearTimeout in both try at L166 and catch at L220). Audit of all other engine timer files found two with real issues: `deepseek.ts` and `rules.ts`.
- **`deepseek.ts` is Qwen under the hood:** `deepseek.ts` uses `getQwenClient()` + `QWEN_REASONING_MODEL` internally — Qwen reasoning replaced DeepSeek at the model level while keeping the function name.

</domain>

<decisions>
## Implementation Decisions

### WR-04 and WR-05 — Already Implemented
- **D-01:** WR-04 (cron N+1 bulk-prefetch) is done at `src/app/api/cron/calculate-trends/route.ts:208–228`. Plan must verify the existing implementation is correct (bulk SELECT + Set construction + fallback to per-row) and close VERIF-04 WR-04 as MET.
- **D-02:** WR-05 (`audio_description` bounds) is done at `src/lib/engine/types.ts:375` and `src/lib/engine/qwen/schemas.ts:77` (both `min(10).max(280)`). Plan must verify both schemas match, then close VERIF-04 WR-05 as MET.

### IN-01 — Timer Leak Fix (deepseek.ts + rules.ts)
- **D-03:** The `gemini.ts` / `analyzeVideoWithGemini` reference in REQUIREMENTS.md VERIF-04 is dead — file deleted during M1 Qwen migration. Close as "resolved by migration." `omni-analysis.ts` (the Qwen video-analysis equivalent) is already correct.
- **D-04:** The real IN-01 work is fixing two files where `clearTimeout` appears only in the try path, not in the catch:
  - `src/lib/engine/deepseek.ts:467–530`: `setTimeout` at L469, `clearTimeout` at L492 (in try), catch at L525 WITHOUT clearTimeout. Fix: restructure to `try { ... } catch { clearTimeout(timeout); ... }` OR wrap in `try/finally`.
  - `src/lib/engine/rules.ts:188–253`: `setTimeout` at L191, `clearTimeout` at L215 (in try), catch at L246 WITHOUT clearTimeout. Same fix.
- **D-05:** All other engine files with timers (`omni-analysis.ts`, `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`, `wave4/platform-fit.ts`) have been audited and are already correct — clearTimeout in both try and catch paths. No changes needed there.
- **D-06:** The fix is to add `clearTimeout` to the catch block (or restructure to try/finally). The existing pattern of "clearTimeout in try, clearTimeout in catch" is acceptable — no need to change files that already do this correctly.

### IN-02 — Vector Cast Centralization
- **D-07:** `as unknown as string` cast is gone — replaced by `JSON.stringify(vectors[j])` during M1. The centralization work remains.
- **D-08:** Create `src/lib/supabase/pgvector.ts` with a single export:
  ```ts
  export function serializeVector(v: number[] | null | undefined): string | null {
    return v ? JSON.stringify(v) : null;
  }
  ```
- **D-09:** Replace the two `JSON.stringify(vectors[j])` instances with `serializeVector(vectors[j])`:
  - `src/app/api/webhooks/apify/route.ts:190`
  - `src/lib/engine/corpus/orchestrator.ts:377`
- **D-10:** Import in both files from `@/lib/supabase/pgvector`. No other files use this pattern.

### IN-03 — sound_url SSRF Allowlist
- **D-11:** Guard is **permissive by design** — users test against all kinds of video URLs (camera roll exports, TikTok CDN, IG, downloads, etc.). No hostname allowlist.
- **D-12:** SSRF guard rules: (1) HTTPS scheme required, (2) no RFC1918 / loopback IPs (`10.*`, `172.16-31.*`, `192.168.*`, `127.*`, `::1`, `fd*`, `fc*`, `169.254.*`). Any public hostname is allowed.
- **D-13:** On violation: log a warning (`log.warn("sound_url SSRF guard rejected", { sound_url })`) and return `null` / skip the row. Do NOT throw — the cron must continue processing remaining rows.
- **D-14:** Location: add the guard in `processSoundEmbedding` (or its call site in `calculate-trends/route.ts`) before the `fetch(sound_url)` call. Resolve the URL's hostname before checking IPs — use `new URL(sound_url)` to extract hostname, then DNS resolve or at minimum check against known private IP ranges in string form.
- **D-15:** Threat model reference: Phase 12 T-06-13 (`sound_url` SSRF). Closing this item satisfies that threat model item.

### VERIF-01/02/03 — UAT Execution Approach
- **D-16:** Manual test scripts with pass/fail log template. Plan generates a markdown step-by-step checklist for each VERIF item — user follows it against the live Vercel deploy.
- **D-17:** Results recorded in `.planning/research/verif-phase2-uat.md` (VERIF-01), `.planning/research/verif-phase3-smoke.md` (VERIF-02), `.planning/research/verif-phase4-uat.md` (VERIF-03). Files are checked in as part of Phase 18 close.
- **D-18:** No Playwright automation — these tests hit live Supabase + Qwen/DashScope APIs that can't be mocked. Manual execution is correct.
- **D-19:** If a live test cannot pass (live-deploy blocker, feature behind gate, or permanently invalid premise), write a "defer permanently" rationale file at the same path. Include: what was attempted, what the blocker is, why it's acceptable to leave deferred. This satisfies the REQUIREMENTS.md escape hatch.

### Verification Gates
- **D-20:** After all code changes: `pnpm vitest run` and `pnpm exec tsc --noEmit` must still be green. No new regressions.
- **D-21:** WR-04 and WR-05 can be verified by reading the code (no runtime test needed). IN-01, IN-02, IN-03 changes must pass `tsc --noEmit` and relevant existing tests.

### Claude's Discretion
- Exact wording / internal structure of VERIF pass/fail log markdown files beyond the content checklist in D-17.
- Whether to split IN-01 into one plan or merge with IN-02/IN-03 — planner decides based on file proximity and risk.
- DNS resolution strategy for IN-03: string-based RFC1918 regex vs actual DNS lookup. String-based is sufficient for the threat model (T-06-13 is about preventing internal probe — most internal IPs are RFC1918).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + Requirements
- `.planning/MILESTONE.md` — Engine Hardening identity; stack decisions block; additive-only rule
- `.planning/REQUIREMENTS.md` §VERIF — VERIF-01 through VERIF-04 wording + sub-items (WR-04, WR-05, IN-01, IN-02, IN-03) + exit criteria
- `.planning/ROADMAP.md` §"Phase 18" — Goal, success criteria, depends-on graph

### VERIF-04 Code Locations
- `src/app/api/cron/calculate-trends/route.ts:208–228` — WR-04 bulk-prefetch (verify done)
- `src/lib/engine/types.ts:362–381` — WR-05 `audio_description` Zod bounds (verify done)
- `src/lib/engine/qwen/schemas.ts:77` — WR-05 Qwen schema bounds (verify matches)
- `src/lib/engine/deepseek.ts:467–530` — IN-01 timer leak fix (in try at L492, missing from catch L525)
- `src/lib/engine/rules.ts:188–253` — IN-01 timer leak fix (in try at L215, missing from catch L246)
- `src/app/api/webhooks/apify/route.ts:190` — IN-02 `JSON.stringify(vectors[j])` to replace with `serializeVector`
- `src/lib/engine/corpus/orchestrator.ts:377` — IN-02 second instance
- `src/lib/engine/qwen/client.ts` — `getQwenClient`, `QWEN_REASONING_MODEL` (used by deepseek.ts)
- `src/app/api/cron/calculate-trends/route.ts` — IN-03 `sound_url` fetch location, `processSoundEmbedding` function

### Prior Phase Context (decision carry-forward)
- `.planning/phases/14-type-hygiene-user-settings-resolution/14-CONTEXT.md` — tsc is already 0 errors; don't re-fix types
- `.planning/phases/17-smoke-runner-live-billing-wiring/17-CONTEXT.md` — smoke runner clean; no scope overlap

### Threat Model
- `.planning/MILESTONE.md` §"Threat model" or Phase 12 notes — T-06-13 (`sound_url` SSRF) is the threat item IN-03 closes

### Engine Architecture
- `src/lib/engine/qwen/client.ts` — confirms `deepseek.ts` uses `getQwenClient` + `QWEN_REASONING_MODEL` (Qwen replaced DeepSeek at model level)
- `src/lib/engine/qwen/omni-analysis.ts:116–237` — `analyzeVideoWithOmni` (confirmed correct timer handling; replaced `analyzeVideoWithGemini`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/` directory (`client.ts`, `server.ts`, `service.ts`, `middleware.ts`) — `pgvector.ts` will be added here as a new peer file
- `createLogger` from `@/lib/logger` — already used across engine files; IN-03 log.warn call follows same pattern
- `log.warn("Bulk idempotency prefetch failed", ...)` in `calculate-trends/route.ts:224` — established pattern for non-fatal cron errors (same `log.warn` + continue approach for IN-03 violation)

### Established Patterns
- Timer pattern in engine files: `const timer = setTimeout(...)` → `try { ... clearTimeout(timer) ... } catch { clearTimeout(timer) }` — already used by `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`, `wave4/platform-fit.ts`. Apply same pattern to `deepseek.ts` and `rules.ts`.
- `serializeVector` will follow the same import-from-lib pattern as other supabase utilities

### Integration Points
- `pgvector.ts` → imported by `webhooks/apify/route.ts` and `corpus/orchestrator.ts`
- IN-03 guard → added inside `processSoundEmbedding` before `fetch(sound_url)`, returns null on violation

</code_context>

<specifics>
## Specific Ideas

- IN-03 guard is **intentionally permissive**: users test against camera roll exports, TikTok CDN, IG downloads, custom URLs — no hostname allowlist. The guard only blocks internal network probing (RFC1918 + loopback). This was an explicit user decision.
- `deepseek.ts` is Qwen-backed: the file is named "deepseek" for historical reasons but internally uses `getQwenClient()` + `QWEN_REASONING_MODEL`. The timer fix applies to the Qwen reasoning call path.

</specifics>

<deferred>
## Deferred Ideas

- **DashScope billing API (IN-03 billing)**: wiring `cost_cents_actual` from the billing endpoint — deferred in Phase 17 CONTEXT.md; revisit when `qwen3.5-omni-plus` exits free preview.
- **Audio fingerprint re-enable (Phase 16)**: AUDIO-01–05 deferred; 17 `.skip`'d tests remain deferred.
- **Content-Type response header validation for sound_url**: would add a second layer to IN-03 but was deemed unnecessary scope. Future hardening if needed.

</deferred>

---

*Phase: 18-m1-verification-debt-closure*
*Context gathered: 2026-05-25*
