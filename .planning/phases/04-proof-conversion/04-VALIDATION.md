---
phase: 4
slug: proof-conversion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` § Validation Architecture (HIGH confidence, all claims VERIFIED in-repo; baseline 1985 green confirmed via `npx vitest run`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (happy-dom via `/** @vitest-environment happy-dom */` pragma, line 1 of every component test) |
| **Config file** | `vitest.config.ts` (default env `node`; component files opt into happy-dom per-file) |
| **Quick run command** | `npx vitest run src/components/marketing/proof/ src/components/marketing/pricing/ src/components/marketing/faq/ src/components/marketing/cta/` (scope per-section during a task) |
| **Full suite command** | `npm test` (`vitest run`) — **baseline 1985 green** as of Phase-3 gap-closure |
| **Estimated runtime** | ~5s scoped · ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the section dir under test>`
- **After every plan wave:** Run `npm test` (full suite green) + `npm run build` (exit 0, route table shows `○ /` static)
- **Before `/gsd:verify-work`:** Full suite must be green + clean build
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below bind each phase requirement to its automated check at plan granularity. The planner MUST align its task `<automated>` verifies to these commands.

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-00 | 0 | PROOF-01/02 · CONVERT-01/02/03 (RED scaffold) | — | N/A (static, input-free) | unit | `npx vitest run src/components/marketing/proof/ src/components/marketing/pricing/ src/components/marketing/faq/ src/components/marketing/cta/` | ❌ W0 creates | ⬜ pending |
| (proof strip) | — | PROOF-01 — trust stat (text) + marquee of ≥N `[data-variant="logo"]` placeholders | — | N/A | unit | `npx vitest run src/components/marketing/proof/__tests__/social-proof-strip.test.tsx` | ❌ W0 | ⬜ pending |
| (proof strip) | — | PROOF-01 — marquee duplicated copies hidden from a11y tree (`aria-hidden`) or labelled (Pitfall 4) | — | Screen reader reads each logo once | unit | same file | ❌ W0 | ⬜ pending |
| (testimonials) | — | PROOF-02 — exactly 3 cards; each = avatar placeholder + name + @handle + quote + result metric (D-07 anatomy) | — | N/A | unit | `npx vitest run src/components/marketing/proof/__tests__/testimonials.test.tsx` | ❌ W0 | ⬜ pending |
| (pricing) | — | CONVERT-01 — 2 tier cards (Starter + Pro); Pro carries "Most popular"; 3–4 bullets each; both CTAs → `SIGNUP_URL` | — | N/A | unit | `npx vitest run src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx` | ❌ W0 | ⬜ pending |
| (pricing) | — | CONVERT-01 — NO Supabase/Whop/CheckoutModal import (D-10 static guard) | Open redirect / heavy-client leak | Pure RSC + internal `<Link>`; no checkout machinery | unit (import-absence) OR build | grep/assert no forbidden import; `npm run build` shows `○ /` | ❌ W0 | ⬜ pending |
| (cta band) | — | CONVERT-02 — band renders before `<Footer/>`; serif close-line; one CTA → `SIGNUP_URL`; `ScoreGaugeSkeleton` echo present | — | N/A | unit | `npx vitest run src/components/marketing/cta/__tests__/final-cta-band.test.tsx` | ❌ W0 | ⬜ pending |
| (faq) | — | CONVERT-03 — 6 items; `type="single"` (one open at a time); each trigger is a `button` (Radix keyboard a11y) | — | N/A | unit | `npx vitest run src/components/marketing/faq/__tests__/faq.test.tsx` | ❌ W0 | ⬜ pending |
| (page) | — | Cross: D-18 order — strip after `#hero`, testimonials after `#features`, pricing fills `#pricing`, faq fills `#faq`, band before footer | — | N/A | unit (page) OR section | extend `page.test.tsx` if present, else assert in section tests | ❌ W0 (verify) | ⬜ pending |
| (nav) | — | Cross: `NAV_LINKS` UNCHANGED (D-19) — still exactly 5 links | Tampering | No new nav anchors introduced | unit | extend existing nav/footer test (`NAV_LINKS.length === 5`) | verify | ⬜ pending |
| all | phase gate | Cross: `/` stays statically prerendered (no `"use client"` leaked to a section root) | — | N/A | build assertion | `npm run build` → route table shows `○ /` | n/a (build gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/marketing/proof/__tests__/social-proof-strip.test.tsx` — PROOF-01 (trust stat + logo marquee count + a11y on duplicated copies)
- [ ] `src/components/marketing/proof/__tests__/testimonials.test.tsx` — PROOF-02 (3 cards, full D-07 anatomy: avatar + name + @handle + quote + metric)
- [ ] `src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx` — CONVERT-01 (2 tiers, "Most popular" Pro, both CTAs → `SIGNUP_URL`, 3–4 bullets, no-forbidden-import guard)
- [ ] `src/components/marketing/cta/__tests__/final-cta-band.test.tsx` — CONVERT-02 (serif close-line, CTA → `SIGNUP_URL`, `ScoreGaugeSkeleton` echo)
- [ ] `src/components/marketing/faq/__tests__/faq.test.tsx` — CONVERT-03 (6 items, single-open, button triggers)
- [ ] Page-order / NAV-unchanged coverage — verify whether a `page.test.tsx` exists to extend; if not, assert section presence + D-18 order + `NAV_LINKS.length === 5` in a small test.
- [ ] Framework install: **none** — Vitest + Testing Library + happy-dom already present (used by `placeholder.test.tsx`, story tests).

*All section tests use the `/** @vitest-environment happy-dom */` pragma (line 1) and are RED-by-design (module-not-found until the section components exist) — the `03-00` scaffold pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Craft/taste: proof strip, testimonials, pricing cards, CTA band, FAQ read "refined, premium, considered" and match the Phase-1/2/3 flat-warm bar | PROOF-01/02 · CONVERT-01/02/03 | Visual taste — five prior attempts failed here; no automated proxy for "refined" | Live UAT at `/`: scroll strip → testimonials → pricing → FAQ → CTA band; confirm flat-matte (no glass/glow), calm rhythm, coral on CTAs only, serif reserved to hero + band close-line, intentional placeholder skeletons (no flat empty boxes / dev labels) |
| Conversion read: the trust stat, result metrics, "Most popular" Pro, and "Free — no credit card" microcopy land as persuasive, not loud | PROOF-01 · CONVERT-01 | Conversion judgment is subjective and human-steered (D-21) | Live UAT: confirm the levers read confident + calm within the flat-warm system; coral restraint held |
| Reduced-motion: logo marquee + section reveals collapse to no-motion under `prefers-reduced-motion` | PROOF-01 · (all) | OS-level media query; primitives self-gate but the composed result needs eyes | Toggle OS reduce-motion → reload `/` → confirm the marquee is static and section entrances appear without transform/opacity animation, no layout jump |
| FAQ keyboard a11y: arrow keys / Enter / Space / focus ring behave (Radix-provided) | CONVERT-03 | Keyboard interaction across a live accordion is integration-level | Tab to the FAQ, arrow between triggers, Enter/Space to toggle; confirm one panel open at a time + visible focus |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 section test files + page-order/NAV-unchanged coverage)
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
