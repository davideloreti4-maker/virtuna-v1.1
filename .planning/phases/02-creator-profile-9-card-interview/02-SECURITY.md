# SECURITY.md — Phase 02: Creator Profile & 9-Card Interview

**Phase:** 02 — creator-profile-9-card-interview
**ASVS Level:** L1
**Block-on:** high
**Audit Date:** 2026-05-18
**Status:** SECURED — 14/14 threats CLOSED

---

## Summary

All 14 threats declared in the Phase 02 plan-level `<threat_model>` blocks have been
verified as either mitigated in code (12) or documented as accepted risk (2). No
unregistered threat flags were surfaced during implementation. No open findings.

---

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-02-01a | T — Migration content integrity | mitigate | `supabase/migrations/20260517210000_creator_profile_9card_columns.sql:9-23` — 14 `ADD COLUMN IF NOT EXISTS` on `creator_profiles` (all nullable); `:26-28` — `user_competitors.source TEXT NOT NULL DEFAULT 'manual_add' CHECK (source IN ('manual_add', 'profile_reference'))`; no `CREATE POLICY`, no `DROP COLUMN`, no `ALTER COLUMN ... DROP NOT NULL` anywhere in file. |
| T-02-02a | E — Migration RLS coverage | mitigate | `supabase/migrations/20260202000000_v16_schema.sql:200-211` — three policies (`Users can view`, `Users can create`, `Users can update`) all gated on `user_id = (SELECT auth.uid())`. Phase 02 migration does NOT add new policies, relying on automatic inheritance per D-17. |
| T-02-04a | I — past_wins / past_flops URLs | **accept** | Documented in Accepted Risks below. User-volunteered URLs; storage retention enforced in Phase 11. Engine-side mitigation overlap: `src/lib/engine/creator.ts:341,346` emits `.length` counts only, never raw URLs to the LLM prompt. |
| T-02-01b | T — Niche slug shape drift | mitigate | `src/lib/niches/__tests__/taxonomy.test.ts:42-49` asserts `/^[a-z0-9]+(-[a-z0-9]+)*$/` against every primary and sub slug. `src/lib/niches/taxonomy.ts` has zero `supabase`/`fetch(`/`process.env` imports — pure data module. |
| T-02-01c | T — UI-level prompt injection precursor | mitigate | `src/components/app/cards/pain-points-input.tsx:23,62` — `MAX_LENGTH = 500` enforced via grapheme-aware `truncateToGraphemes` (WR-12 strengthens beyond plan's `maxLength` attribute — same blast-radius bound). `src/components/app/cards/reference-creators-input.tsx:35` — `MAX_ENTRIES = 3`. `src/components/app/cards/wins-flops-input.tsx:37` — `MAX_PER_COLUMN = 2`. |
| T-02-03a | I — Apify cost runaway | mitigate | UI cap: `src/components/app/cards/reference-creators-input.tsx:35` — `MAX_ENTRIES = 3`. Idempotency: `src/app/actions/competitors/add.ts:140-142` — `23505` unique-violation handler returns benign already-tracking message. Normalization: `src/stores/profile-interview-store.ts:227-228` — `normalizeHandle(raw)` then `length < 2` early-continue. |
| T-02-02 store | E — IDOR via persistCardData | mitigate | `src/stores/profile-interview-store.ts:107` — `await supabase.auth.getUser()` inside helper; `:122` — `.eq("user_id", user.id)` always uses session-derived id. Documented in source comment at `:96-99`. |
| T-02-05a | S — Modal-bypass via direct DB write | **accept** | Documented in Accepted Risks below. RLS restricts UPDATEs to user's own row; `profile_interview_seen_at` is a UX hint, not a security boundary. |
| T-02-01-card8 | T — Pain text control chars in store | mitigate (partial) | `src/stores/profile-interview-store.ts:181` — `case 8: return { pain_points: draft.pain.trim() || null }`. `src/components/app/cards/pain-points-input.tsx:23,62` — 500 grapheme cap. Full control-char + zero-width strip lands at API boundary in `src/lib/schemas/creator-profile.ts:112-126` (`sanitizeText`). |
| T-02-01 api | T — Profile-as-vector prompt injection at API | mitigate | `src/lib/schemas/creator-profile.ts:22-47` — z.enum for every controlled field (platforms, age range, gender, goal, stage, style, cuts, cadence). `:60,68,72,76,81` — length caps (niche 64, ref handle 256, URL 512, pain 500). `src/app/api/profile/creator-profile/route.ts:137` — `safeParse` then `:156,163,171,179` — `sanitizeText` on every free-text path before upsert. WR-07/WR-B additions strip zero-width chars + LLM delimiter sentinels. |
| T-02-02 api | E — IDOR on PATCH | mitigate | `src/app/api/profile/creator-profile/route.ts:1` — `import { createClient } from "@/lib/supabase/server"` (authenticated SSR client, NOT service role). `:127-134` — `auth.getUser()` returns 401 if absent. `:189` — upsert sets `user_id: user.id` from session, spreading sanitized payload after, so any caller-supplied `user_id` is overwritten. |
| T-02-05 api | S — Direct API call modal-bypass | mitigate | `src/app/api/profile/creator-profile/route.ts:55-57,132-134` — both GET and PATCH return 401 on missing user. `:137` — `safeParse` happens before any write. `:189-191` — upsert via authenticated client only, no service-role bypass. WR-05 hardening adds Content-Type 415 guard and cross-origin 403 guard. |
| T-02-01 engine | T — Profile-as-vector prompt injection at engine read | mitigate | `src/lib/engine/creator.ts:300-371` — every new field push is guarded by `if (ctx.{field}` check (lines 300, 303, 307, 316, 317, 318, 319, 322, 339, 344, 349, 354). `:339-348` — past_wins/past_flops surface as `.length` counts only, never raw URLs. WR-08 wraps user-supplied reference handles and pain_points in `<<<USER_CONTENT>>>` delimiters; WR-B duplicates delimiter sentinel strip at consumption site. |
| T-02-02 card5 | E — IDOR on Card 5 reference-creator side-effect | mitigate | `src/app/actions/competitors/add.ts:20-23` — `createClient` (authenticated) then `auth.getUser()` inside action. `:136` — junction insert uses `user_id: user.id` from session, never caller-supplied. `src/stores/profile-interview-store.ts:230` — store calls `addCompetitor(normalized, "profile_reference")` without supplying user_id at all. |

**Totals:** 14/14 closed (12 mitigated, 2 accepted).

---

## Accepted Risks

The following dispositions were marked as `accept` in the plan-level threat models.
Each is documented here as part of the project's risk register.

### T-02-04a — past_wins / past_flops URLs (Information Disclosure)
- **Component:** `creator_profiles.past_wins` + `creator_profiles.past_flops` JSONB columns
- **Rationale:** URLs are user-volunteered. The user explicitly enters their own video
  links to provide context for the prediction engine. The data is row-scoped under RLS
  (`user_id = auth.uid()` enforces tenant isolation), so cross-user disclosure is
  impossible. No new PII surface beyond what the table already stores.
- **Compensating controls:**
  - Engine-side prompt formatter (`src/lib/engine/creator.ts:339-348`) surfaces
    counts only, never raw URLs to the LLM — limits prompt-injection blast radius and
    third-party disclosure to vendor SDK.
  - Storage retention enforced by the existing 30-day policy applied to
    `creator_profiles` rows — Phase 11 scope.
- **Accepted by:** Phase 02 D-14 / D-19 (in plan `<threat_model>` blocks of 02-01,
  02-05, 02-06).
- **Review trigger:** If retention policy changes, or if URLs ever flow into the LLM
  prompt as raw strings, re-evaluate this acceptance.

### T-02-05a — Modal-bypass via direct DB write (Spoofing)
- **Component:** `creator_profiles.profile_interview_seen_at`
- **Rationale:** RLS already restricts UPDATEs to the user's own row. The
  `profile_interview_seen_at` flag is a UX hint (controls whether the interview
  modal opens on next upload), not a security boundary. A user can self-bypass by
  flipping their own row, which only changes whether they see the modal — no other
  state is gated by this flag.
- **Compensating controls:** None required — the flag is non-security-critical by
  design.
- **Accepted by:** Phase 02 D-04 / D-14 (in plan `<threat_model>` blocks of 02-04
  and 02-06). Also explicitly documented in `02-04-SUMMARY.md:218`.
- **Review trigger:** If any future feature gates access or billing on
  `profile_interview_seen_at`, this acceptance must be revisited.

---

## Unregistered Flags

None. The Phase 02 SUMMARY chain (`02-01-SUMMARY.md` through `02-06-SUMMARY.md`)
contains only `02-06-SUMMARY.md:181-186` with a `## Threat Flags` section, and that
section explicitly states "None" — every threat surfaced during implementation maps
back to a declared threat in the plan's `<threat_model>` blocks.

---

## Open Findings

None.

---

## Notes — Implementation Strengthenings Beyond Plan

Several mitigations exceed the plan's declared scope. These are noted (not required
for SECURED status) so future auditors can trace the depth of defense:

- **WR-07 (zero-width chars):** `sanitizeText` strips `U+200B/200C/200D/2060/FEFF` in
  addition to ASCII control characters. Closes a prompt-injection vector the plan did
  not explicitly call out.
- **WR-B (LLM delimiter sentinels):** Both the API sanitize layer
  (`src/lib/schemas/creator-profile.ts:124`) and the engine formatter
  (`src/lib/engine/creator.ts:252-254`) strip literal `<<<USER_CONTENT>>>` /
  `<<<END_USER_CONTENT>>>` markers from user input — defense-in-depth against fence
  escape via legacy data or raw SQL paths.
- **WR-08 (user-content fencing):** `formatCreatorContext` wraps user-supplied
  reference handles and pain_points in `<<<USER_CONTENT>>>` blocks before sending to
  the LLM — additional layer beyond enum/length caps.
- **WR-12 (grapheme-aware cap):** PainPointsInput uses `Intl.Segmenter` for
  truncation, which is more robust than the plan's `maxLength={500}` attribute (which
  uses code-unit length).
- **WR-05 (Content-Type + Origin):** PATCH route returns 415 on non-JSON Content-Type
  and 403 on cross-origin requests. Bonus CSRF defense-in-depth not required by L1.
- **WR-04 (at-most-once fire):** `referencesFired` sentinel in
  `src/stores/profile-interview-store.ts:53` prevents double-firing of the Card 5
  side-effect across `advanceCard` + `finalize`. Cost-saving on top of the 23505
  idempotency.

---

## Verification Method

- Direct grep against each cited file path
- Cross-checked declared file:line evidence against the actual implementation
- Confirmed Wave 0 scaffolds were flipped to active assertions in 02-06
- Confirmed RLS policy file (`20260202000000_v16_schema.sql`) is upstream of and
  unmodified by Phase 02 migration
- Confirmed SUMMARY `## Threat Flags` sections for any new surface (`02-06-SUMMARY.md`
  reports None)

Audit performed by `gsd-security-auditor` agent on 2026-05-18.
