---
phase: 3
slug: honesty-moat-gallery-proof-conversion
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
updated: 2026-06-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 03-RESEARCH.md §"Validation Architecture" (Req→Test map) + the
> `<automated>` verify command already written into each plan task.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (happy-dom env) + @testing-library/react |
| **Config file** | `vitest.config.ts` (has `staticImageStub` for `.webp` imports; `@/` alias; happy-dom) |
| **Quick run command** | `npx vitest run <file>` (per touched test) |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~15 seconds (component/unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the touched component/seam test>`
- **After every plan wave:** Run `npm test` (full vitest run)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CTA-02 / PROOF-01 | T-03-01 | dup-as-success encodes no-enumeration-leak | unit (scaffold) | `npx vitest run "src/app/(marketing)/__tests__/actions.test.ts" "src/lib/__tests__/waitlist-count.test.ts"` (RED expected) | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | TRUST-01/02, GALLERY-01/02, PROOF-01/D-09 | — | semantic table + scoped rival strings; verdict range; never "0 creators" | unit (scaffold) | `npx vitest run src/components/numen-landing/__tests__/honesty-comparison.test.tsx src/components/numen-landing/__tests__/reading-gallery.test.tsx src/components/numen-landing/__tests__/social-proof.test.tsx` (RED expected) | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PROOF-02/D-10, single-h1 | — | one source two surfaces; single top-level heading | unit (scaffold) | `npx vitest run src/components/numen-landing/__tests__/proof-placement.test.tsx "src/app/(marketing)/__tests__/page-headings.test.tsx"` (RED expected) | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | TRUST-02 / CONTENT-02 | — | voice gate bans rival strings outside honesty-comparison | unit (scaffold) | `npx vitest run src/components/numen-landing/__tests__/voice.test.tsx` (RED expected) | ✅ extend | ⬜ pending |
| 03-02-01 | 02 | 2 | TRUST-01/02, CONTENT-02 | T-03-02 | rival strings scoped to honesty-comparison only | unit (a11y) | `npx vitest run src/components/numen-landing/__tests__/honesty-comparison.test.tsx` | ❌→✅ via 03-01-02 | ⬜ pending |
| 03-03-01 | 03 | 2 | GALLERY-01/02 | — | VerdictThrone parametrized; no-props output unchanged | unit | `npx vitest run src/components/numen-landing/__tests__/voice.test.tsx src/components/numen-landing/__tests__/hero.test.tsx` | ✅ | ⬜ pending |
| 03-03-02 | 03 | 2 | GALLERY-01 | T-03-03 | non-blocking still extraction (checkpoint) | manual | checkpoint:human-verify (`file public/images/landing/gallery/*.webp` or "proceed with placeholders") | n/a | ⬜ pending |
| 03-03-03 | 03 | 2 | GALLERY-01/02, CONTENT-02 | — | ≥3 cards, alts, good/mixed/bad range, opaque Surface | unit | `npx vitest run src/components/numen-landing/__tests__/reading-gallery.test.tsx` | ❌→✅ via 03-01-02 | ⬜ pending |
| 03-04-01 | 04 | 1 | CTA-02 / PROOF-01 | T-03-04/05/06/07 | insert-only RLS + SECURITY DEFINER count + source CHECK | source-assert | `test -f supabase/migrations/20260612000000_waitlist.sql && grep -qi 'SECURITY DEFINER' … && grep -qi 'ENABLE ROW LEVEL SECURITY' … && grep -qi 'FOR INSERT' …` | n/a (SQL) | ⬜ pending |
| 03-04-02 | 04 | 1 | CTA-02 / PROOF-01 | T-03-04/05 | [BLOCKING] migration applied; anon SELECT returns 0 rows; types regen | manual + CLI | checkpoint:human-action (`grep -c waitlist src/types/database.types.ts` ≥ 2; anon SELECT 0 rows) | n/a | ⬜ pending |
| 03-04-03 | 04 | 1 | CTA-02 / PROOF-01 | — | regenerated types valid; db:types script | type-check | `grep -q '"db:types"' package.json && grep -q 'waitlist_count' src/types/database.types.ts && npx tsc --noEmit …` | n/a | ⬜ pending |
| 03-05-01 | 05 | 3 | CTA-02 / PROOF-01 | T-03-08/09/10/12 | honeypot, validation, 23505→success, source allowlist, cached error→0 | unit | `npx vitest run "src/app/(marketing)/__tests__/actions.test.ts" "src/lib/__tests__/waitlist-count.test.ts"` (GREEN) | ❌→✅ via 03-01-01 | ⬜ pending |
| 03-05-02 | 05 | 3 | CTA-02, PROOF-01/02, CONTENT-02 | T-03-08/09/11 | form honeypot + states; D-09 guard; placeholder testimonials | unit | `npx vitest run src/components/numen-landing/__tests__/social-proof.test.tsx` (GREEN) | ❌→✅ via 03-01-02 | ⬜ pending |
| 03-05-03 | 05 | 3 | PROOF-02, CONTENT-02, single-h1 | T-03-12 | one source two surfaces; single h1; full voice gate green; live flow | unit + manual | `npx vitest run src/components/numen-landing/__tests__/voice.test.tsx` + proof-placement + page-headings GREEN; live form-flow checkpoint | ❌→✅ via 03-01-03/04 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Note: Wave-0 scaffolds (03-01) are RED by design until Waves 2–3 implement against them; the "❌→✅ via 03-01-NN" rows are the same scaffolds turning GREEN as production code ships.

---

## Wave 0 Requirements

- [ ] `src/app/(marketing)/__tests__/actions.test.ts` — CTA-02 (honeypot, invalid email, 23505→success; mock `@/lib/supabase/server`)
- [ ] `src/lib/__tests__/waitlist-count.test.ts` — PROOF-01 (RPC number passthrough, error→0)
- [ ] `src/components/numen-landing/__tests__/honesty-comparison.test.tsx` — TRUST-01/02 (`<table>` semantics + scoped rival strings)
- [ ] `src/components/numen-landing/__tests__/reading-gallery.test.tsx` — GALLERY-01/02 (≥3 imgs, alts, verdict range)
- [ ] `src/components/numen-landing/__tests__/social-proof.test.tsx` — PROOF-01/D-09 (threshold guard, never "0 creators")
- [ ] `src/components/numen-landing/__tests__/proof-placement.test.tsx` — PROOF-02/D-10 (ProofStrip + SocialProof get the SAME count — one source, two surfaces)
- [ ] `src/app/(marketing)/__tests__/page-headings.test.tsx` — single-h1 invariant (exactly one level-1 heading after slots filled)
- [ ] `src/components/numen-landing/__tests__/voice.test.tsx` — EXTEND (four new components ban scan; honesty-comparison positively asserted as sole home of rival strings)
- [ ] Framework install: none — vitest + @testing-library/react already present (`vitest.config.ts` configured)

All eight Wave-0 files are authored in Plan 03-01 (Tasks 1–4). `wave_0_complete` flips to `true` once 03-01 ships.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Distinct-niche still extraction | GALLERY-01 | ffmpeg→cwebp on user-supplied clips; non-blocking (D-07) | 03-03 Task 2 checkpoint: `file public/images/landing/gallery/*.webp` → 720-wide portrait WebP, OR "proceed with placeholders" |
| Remote migration apply + types regen | CTA-02/PROOF-01 | [BLOCKING] schema push to remote `virtuna-v1.1`; needs MCP/CLI auth | 03-04 Task 2: `waitlist_count()` returns bigint; anon SELECT on waitlist returns 0 rows; `grep -c waitlist src/types/database.types.ts` ≥ 2 |
| Live form flow + reduced-motion + deploy env | CTA-02/PROOF-02 | requires running dev server + live Supabase round-trip + visual reduced-motion check | 03-05 Task 3: submit email → "You're on the list."; dup → identical; invalid → error; count increments (source correct); reduced-motion static; deploy env carries NEXT_PUBLIC_SUPABASE_URL + anon key |

The PROOF-02 "one source, two surfaces" and single-h1 invariants are NOT manual-only — they have automated scaffolds (proof-placement.test.tsx, page-headings.test.tsx). 03-05 Task 3 keeps a manual grep as belt-and-suspenders.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the three checkpoint tasks — 03-03-02, 03-04-02, 03-05-03 — are manual by necessity and listed above; every auto task has an automated command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every auto task carries a vitest/grep/tsc command)
- [x] Wave 0 covers all MISSING references (8 scaffolds in Plan 03-01, incl. proof-placement + page-headings for the two warnings)
- [x] No watch-mode flags (`vitest run`, never `vitest --watch`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12
