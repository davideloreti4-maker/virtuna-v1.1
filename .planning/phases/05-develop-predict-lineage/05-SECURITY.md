# SECURITY.md — Phase 05: Develop & Predict + Lineage

**Phase:** 05 — Develop & Predict + Lineage
**Audit date:** 2026-06-02
**ASVS Level:** 2
**block_on:** high (OPEN_THREATS only)
**Auditor model:** claude-sonnet-4-6

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-01 | Tampering / Info-disclosure | mitigate | CLOSED | `src/lib/engine/types.ts:164` — `parent_id: z.string().optional()` inside `AnalysisInputSchema`; pointer stored only, not used to read another row this path. `route.ts:540,706` carry `validated.parent_id` into DB; auth gate at route entry ensures row is owned by `user.id`. |
| T-05-02 | Integrity | mitigate | CLOSED | `supabase/migrations/20260602000000_add_parent_id_to_analysis_results.sql:7` — `REFERENCES public.analysis_results(id) ON DELETE SET NULL`; live DB constraint confirmed (pg_constraint `confdeltype = 'n'`). Bad parent_id rejected at insert; delete nulls child pointer. |
| T-05-11 | Integrity (data loss) | accept | CLOSED | Accepted per plan: SQL UPDATE only writes listed columns. Verified at `route.ts:899-933` — safety-net UPDATE block lists `mode`, `overall_score`, score columns, etc. but NOT `parent_id`. Grep on lines 897-935 returns zero `parent_id` hits. Placeholder INSERT at `route.ts:706` sets `parent_id: validated.parent_id ?? null`; the subsequent UPDATE cannot clobber it. |
| T-05-03 | DoS (cost/latency) | mitigate | CLOSED | `src/components/board/adapt/AdaptFrameBody.tsx:93-103` — `developStream.start(...)` is called only inside `handleDevelop`, which is only reachable via a single card's `onClick` (`AdaptConceptCard:64`). No loop or prefetch. `isPending` check at `AdaptFrameBody.tsx:299-303` covers `analyzing\|reconnecting\|polling` phases, disabling all card triggers while stream is in flight. DAILY_LIMITS/429 gate confirmed at `route.ts:406-416`. |
| T-05-04 | Tampering | mitigate | CLOSED | `AdaptFrameBody.tsx:99` — `parent_id: analysisId` where `analysisId` is the user's own source remix id from `usePermalinkAnalysis` (line 60). Value passes through `AnalysisInputSchema` (T-05-01). Ownership re-checked server-side at `api/analysis/[id]/route.ts:29-32` on chip read. |
| T-05-05 | Info disclosure | accept | CLOSED | Accepted per plan: brief assembled from `concept.hook + concept.angle + concept.format_borrowed` at `AdaptFrameBody.tsx:84-88` — only user's own niche-adapted concept fields; no source caption or third-party content. |
| T-05-06 | Info disclosure | mitigate | CLOSED | `src/app/api/analysis/[id]/route.ts:26-51` — `?summary` branch runs AFTER `.eq("id", id).eq("user_id", user.id).is("deleted_at", null).single()` at lines 26-32. A forged/cross-user `parent_id` causes the SELECT to return no row → 404 at lines 34-38 before the summary branch at line 45 is reached. Response restricted to `{ id, caption (≤120 chars), created_at }` — no scores, personas, or video paths. |
| T-05-07 | Info disclosure | mitigate | CLOSED | `src/components/board/RemixedFromChip.tsx:48-65` — caption rendered as React text child inside `<a>` tag. No `dangerouslySetInnerHTML` (grep: 0 occurrences). Caption truncated to 40 chars at line 49. |
| T-05-08 | Spoofing | accept | CLOSED | Accepted per plan: `Sidebar.tsx:586-598` — `isRemix` derived inline from `board.overall_score == null && variants?.remix != null`; render-side classification of user's own rows; no trust boundary crossed. |
| T-05-09 | DoS (UI) | mitigate | CLOSED | `src/components/board/FrameErrorBoundary.tsx:33-38` — class component with `static getDerivedStateFromError` + `componentDidCatch`. Wraps both Decode and Adapt mounts in `Board.tsx:518-525` and `BoardMobile.tsx:136-145`. Score-mode frames are NOT wrapped — regression surface minimal. A render throw in either frame is contained; rest of board renders. |
| T-05-10 | Info disclosure | accept | CLOSED | Accepted per plan: `FrameErrorBoundary.tsx:49-53` — fallback renders `"{frameLabel} couldn't render"` (generic, no stack/PII). Raw error logged only via `console.error('[FrameErrorBoundary]', ...)` at line 38, not rendered to DOM. |
| T-05-SC | Tampering | mitigate | CLOSED | `package.json` — no new runtime dependencies introduced this phase. `FrameErrorBoundary` uses React's built-in class lifecycle. `AdaptConceptCard` plain-text arrow `→` (no icon package). Dep list unchanged from Phase 4 baseline. |

---

## Resume-on-Mount Polling Path (Post-Plan Fix)

**Scope:** commits cited in prompt (SSE controller-close guards + resume-on-mount polling branch in `use-analysis-stream.ts`)

The resume path at `use-analysis-stream.ts:533-546` flips phase to `'polling'` for null-score `engine_version='pending'` rows where `mode !== 'remix'`. It then polls via `GET /api/analysis/${urlAnalysisId}` (line 494). That endpoint enforces `.eq("user_id", user.id)` (route.ts:29-32) — a session-authenticated Supabase client; unauthenticated or cross-user requests receive 401/404. The resume path does NOT bypass ownership scoping.

**Verdict:** No new threat surface. Existing T-05-06 ownership enforcement covers this path.

---

## Unregistered Flags

None — all threat flags from SUMMARY.md files map to existing threat IDs in the register. No new attack surface appeared during implementation with an absent threat mapping.

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-05-11 | Safety-net UPDATE preserves parent_id by omission | SQL UPDATE semantics guarantee unlisted columns are untouched; placeholder INSERT (Site 3) sets parent_id first; no parent_id clobber possible. Verified by grep on UPDATE block. |
| T-05-05 | content_text brief from concept | Brief contains only user's own concept fields (hook/angle/format_borrowed); no third-party data. Phase 4 ADAPT-02 already excluded source captions from concepts. |
| T-05-08 | Recent "Remix" tag classification | Render-side only; keys on user's own row fields; no trust boundary crossed. |
| T-05-10 | FrameErrorBoundary console.error output | Error logged to dev tooling (console) only; not rendered to DOM; no stack/PII exposure in production UI. |
