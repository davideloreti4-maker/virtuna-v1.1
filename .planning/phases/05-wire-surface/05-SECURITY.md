# SECURITY.md — Phase 5 (Wire + Surface) — Apollo Milestone

**Phase:** 5 — Wire + Surface
**Audit date:** 2026-06-06
**Branch:** milestone/engine-opt
**Auditor:** gsd-security-auditor (sonnet)
**ASVS Level:** 2

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-01 | Tampering | mitigate | CLOSED | `src/lib/engine/types.ts:786` — `ApolloDimensionSchema.score: z.number().min(0).max(100)`; post-parse composite clamp `deepseek.ts:149,163` |
| T-05-02 | Tampering (integrity) | mitigate | CLOSED | `src/lib/engine/cache/prediction-cache.ts:17,21,88` — key = `${contentHash}::${ENGINE_VERSION}::${userId}`; L2 also filters `.eq("engine_version", ENGINE_VERSION)` |
| T-05-03 | Tampering | accept | CLOSED | See Accepted Risks below |
| T-05-04 | Tampering | mitigate | CLOSED | `src/lib/engine/aggregator.ts:215` — `lo = Math.max(0, ...)`, `hi` minimum-gap enforced at line 219–221; null returned when follower_count null/undefined/<= 0 (lines 188–195) |
| T-05-05 | Tampering | mitigate | CLOSED | `src/lib/engine/creator.ts:267–268` — R11 path reads only `ctx.follower_count` (numeric, `.toLocaleString()`); sentinel strip `stripUserContentSentinels` present at lines 252–253, applied to all free-text fields (reference_creators, pain_points) |
| T-05-06 | Info disclosure | **re-disposition: mitigate** | CLOSED | `src/app/api/analyze/route.ts:221–248` — `persistApolloToVariants` reads with `.eq("user_id", userId)` (line 234) and writes with `.eq("user_id", userId)` (line 248); null-gate: `if (engagement_range) merged.engagement_range = engagement_range` (line 243) — null range is never persisted; no cross-user read/write possible via service client because both read and update are row-scoped |
| T-05-07 | Tampering | mitigate | CLOSED | `src/components/board/InsightHeroFrame.tsx:188–191` — `apollo = row?.variants?.apollo ?? row?.apollo_reasoning ?? null`; render-only, no mutation |
| T-05-08 | Info disclosure / XSS | accept | CLOSED | See Accepted Risks below |
| T-05-09 | Tampering | mitigate | CLOSED | `src/components/board/InsightHeroFrame.tsx:151–153` — `typeof (dim as ApolloDimension).score === 'number'`; numeric bounds enforced engine-side at `types.ts:786` |
| T-05-10 | Tampering | mitigate | CLOSED | `src/components/board/verdict/VerdictNode.tsx:279–302` — `EngagementRangeBlock` reads already-clamped `range.lo` / `range.hi` from engine; null-gated at line 283 `if (!range) return null`; no arithmetic on untrusted input, React JSX escapes all text |
| T-05-11 | Info disclosure | accept | CLOSED | See Accepted Risks below |
| T-05-SC | Tampering | mitigate | CLOSED | Zero external npm installs in Phase 5; verified by implementation scope (R11 surface + persistence + follower backfill — no new package.json entries) |

---

## New Surface Verification (CRITICAL items)

### T-05-06 re-disposition: predicted_engagement persistence

**Verdict: CLOSED — re-disposition from accept to mitigate confirmed.**

`persistApolloToVariants` in `src/app/api/analyze/route.ts`:
- Read: `.eq("id", id).eq("user_id", userId)` — user-scoped (line 234)
- Write: `.eq("id", id).eq("user_id", userId)` — user-scoped (line 248)
- Null-gate: `if (engagement_range) merged.engagement_range = engagement_range` (line 243) — truthy check; null/undefined never persisted
- Cross-user disclosure impossible: service client read is user-row-scoped before merge; the merged write target is the same row

### New surface: `backfillCreatorFollowers` (SSRF/arbitrary-target check)

**Verdict: CLOSED.**

(a) Handle source: `creatorProfile.tiktok_handle` — loaded at line 494–498 from `creator_profiles` scoped `.eq("user_id", user.id)` via the user's own authed Supabase client. Not attacker-controllable from the request body; the `validated.creator_handle` path also sources from the same DB row (line 568–569). No request-body handle ever reaches `backfillCreatorFollowers`.

(b) UPDATE scoped: `.eq("user_id", userId)` at line 77 — no cross-user write.

(c) Fire-and-forget error channel: entire async block wrapped in `try/catch` (lines 65–85); errors caught, logged via `log.warn` (no stack trace to client), never re-thrown. No information leak via error channel.

### New surface: `EngagementRangeBlock` in VerdictNode.tsx

**Verdict: CLOSED — matches T-05-10 disposition.**

`src/components/board/verdict/VerdictNode.tsx:277–303`:
- Dual-read: `result.predicted_engagement ?? result.variants?.engagement_range ?? null`
- Null-gate: `if (!range) return null` — renders nothing when no baseline
- Display-only: `formatViews(range.lo)` and `formatViews(range.hi)` — both values are already-clamped integers from `computeEngagementRange` (lo >= 0, hi > lo); no arithmetic on untrusted input in render path
- React JSX — all interpolations auto-escaped, no `dangerouslySetInnerHTML`
- `range.confidence` passed to `rangeConfidenceLabel(c: number)` — numeric, display-only string derivation

---

## Accepted Risks

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-05-03 | Tampering | Apollo §4 prompt (`APOLLO_SYSTEM_PROMPT`) is a byte-stable compile-time constant in `apollo-core.ts`. No user input flows into the prompt template itself; only the formatted creator context and verbatim hook (already sanitized via `stripUserContentSentinels`) are appended at call time. Risk accepted: prompt is not user-controlled. |
| T-05-08 | Info disclosure / XSS | React renders all rewrite/dimension text via standard JSX interpolation (`{rewrite.variant}`, `{rewrite.original}`, `{dim.name}`). No `dangerouslySetInnerHTML` in `InsightHeroFrame.tsx` or `VerdictNode.tsx`. Clipboard writes only `rewrite.variant` (a string); no DOM injection vector. Risk accepted: React escaping is the standard mitigation at this ASVS level. |
| T-05-11 | Info disclosure | `analysis_results` results-panel data path unchanged from pre-Phase-5. Data flows through the existing `useAnalysisStream` / `usePermalinkAnalysis` hooks, which fetch only rows owned by the authed user. No new fetch or persist path added in Phase 5 for this surface. Risk accepted: data path is unchanged. |

---

## Unregistered Flags

None. No SUMMARY.md `## Threat Flags` block was produced for this phase; all new attack surface (engagement_range persist, backfillCreatorFollowers, EngagementRangeBlock render) was pre-registered in the CRITICAL addendum and verified above.

---

## Summary

**Threats closed:** 12/12
**Threats open:** 0
**Blockers:** none
**Phase 5 ship status: CLEAR**
