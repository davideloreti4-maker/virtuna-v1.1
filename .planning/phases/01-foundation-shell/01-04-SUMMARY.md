---
phase: 01-foundation-shell
plan: 04
subsystem: marketing-chrome
tags: [header, navigation, flat-warm, mobile-nav, nav-01, nav-03]
requires:
  - "src/lib/routes.ts (SIGNUP_URL/LOGIN_URL — from 01-01)"
  - "src/components/brand/numen-logo.tsx (NumenLogo)"
  - "src/components/ui/button.tsx (Button asChild)"
  - "flat-warm @theme tokens in src/app/globals.css (from 01-01)"
  - "scroll-skeleton section anchor ids #hero/#how-it-works/#the-simulation/#pricing/#faq (from 01-01)"
provides:
  - "Flat-matte sticky <Header> (NumenLogo + 4 anchors + Try it free CTA + Sign in + mobile collapse)"
  - "NAV-01 + NAV-03 happy-dom test coverage"
affects:
  - "src/app/(marketing)/page.tsx (Header already mounted by the 01-01 skeleton — visual swap only, no re-wire)"
tech-stack:
  added: []
  patterns:
    - "useState disclosure for mobile nav (NOT Radix Sheet — D-21, 3–4 items)"
    - "Button asChild + next/link for the primary CTA"
    - "lucide-react Menu/X icons (UI-SPEC primary icon set; replaces phosphor List/X)"
    - "data-testid hook (mobile-nav-panel) for deterministic open/close assertions"
key-files:
  created:
    - "src/components/layout/__tests__/header.test.tsx"
  modified:
    - "src/components/layout/header.tsx"
decisions:
  - "Bar surface = bg-background-elevated (#1a1a18) — one tone-step off the page bg, opaque (no backdrop-blur)"
  - "Logo links to #hero (the skeleton's hero anchor), not a bare #top"
  - "Mobile panel uses shadow-float (the ONE permitted shadow — it floats); bar itself rests on border+tone only"
  - "CTA uses the Button primitive variant=primary asChild (flat-matte shadow-button already token-driven post-port)"
metrics:
  duration: ~7min
  completed: 2026-06-14
  tasks: 2
  files: 2
---

# Phase 1 Plan 04: Header Chrome (NAV-01 + NAV-03) Summary

Rewrote the marketing header from scratch on flat-warm: a flat opaque sticky bar (NumenLogo + "Numen" wordmark, 4 in-page anchor links, a terracotta "Try it free" CTA → `/signup`, a subtle "Sign in" → `/login`, and a lightweight `useState` mobile collapse that closes on tap) replacing the old glass societies pill in place via TDD (RED test → GREEN rewrite).

## What Was Built

- **`src/components/layout/__tests__/header.test.tsx`** (new, 87 lines) — happy-dom + `userEvent` coverage encoding the NAV-01 + NAV-03 contract: NumenLogo wordmark presence, `Try it free`→`/signup`, `Sign in`→`/login`, mobile toggle (`aria-label="Open menu"`) opens a `mobile-nav-panel` and the trigger flips to `Close menu`, and tapping a panel link collapses it (open→closed).
- **`src/components/layout/header.tsx`** (rewritten, 159 lines) — flat-matte sticky `<header>` landmark at `z-[200]` (`--z-sticky`), `h-16`, opaque `bg-background-elevated` + hairline `border-b border-border`, no glass/blur/shine/drop-shadow. Left: `NumenLogo` linked to `#hero`. Center (desktop): `How it works · The Simulation · Pricing · FAQ` anchor links (cream-secondary → cream-primary hover). Right (desktop): ghost `Sign in` + terracotta `Try it free` CTA via `Button asChild`. Mobile: a `useState` disclosure with a ≥44px lucide `Menu`/`X` icon-button toggling a flat `shadow-float` charcoal panel containing the anchors + Sign in + a full-width CTA; every link calls `closeMenu` (closes on tap). Body scroll is locked while open and always restored on close/unmount. CTA + auth paths come from `@/lib/routes` (`SIGNUP_URL`/`LOGIN_URL`) — no hardcoded paths.

## TDD Cycle

| Gate | Commit | Result |
|------|--------|--------|
| RED | `ddabee50` `test(01-04)` | 5 failed / 1 passed against the old glass header (wrong hrefs `/auth/login`, "Book a Meeting"→calendly, `aria-label="Toggle navigation menu"`, no panel testid) — correct RED |
| GREEN | `2f7a2e57` `feat(01-04)` | 6/6 PASS after the flat-matte rewrite |

No REFACTOR commit needed (the GREEN implementation was already clean).

## Verification

- `pnpm vitest run src/components/layout/__tests__/header.test.tsx` → **6/6 PASS**.
- Plan grep guards: `header.tsx` contains `NumenLogo`, `SIGNUP_URL`, `LOGIN_URL`; contains NO `backdropFilter`/`backdrop-blur`/`gradient-navbar`/`calendly` (comments reworded so the literal guard is clean too). PASS.
- Wave-merge gate (VALIDATION sampling): `pnpm build` → **exit 0** (typecheck + compile; `/signup` and `/login` routes present, confirming CTA targets resolve). `pnpm vitest run src/components/layout src/components/marketing` → **17/17 PASS**.
- `pnpm lint` → **zero** errors/warnings in `header.tsx` / `header.test.tsx` (the 58 errors / 68 warnings reported are pre-existing project-wide and out of scope per the scope boundary).

## Deviations from Plan

None — plan executed exactly as written. (Minor in-criteria adjustment: reworded two source comments that contained the literal strings "backdrop-blur" so the plan's literal forbidden-pattern grep passes cleanly — no behavioral change, no scope change.)

## Known Stubs

None. The header is static navigation chrome; the in-page anchor links target the 01-01 skeleton section ids, and the off-surface CTA/auth links point at the real `/signup` and `/login` app routes.

## Threat Surface

No new surface beyond the plan's `<threat_model>` (T-01-04 / T-01-04b, both `accept`). The header is static chrome — hrefs are hardcoded internal app paths via `SIGNUP_URL`/`LOGIN_URL` (no user-derived or external links, no `target=_blank`), and the bundle carries no secrets/tokens/env. No threat flags.

## Requirements Satisfied

- **NAV-01** — header shows the Stele NumenLogo + "Numen" wordmark + a "Try it free" CTA → `/signup`.
- **NAV-03** — on small screens the header collapses to an icon-button nav that opens a flat panel and closes on link tap.

## Self-Check: PASSED

- `src/components/layout/header.tsx` — FOUND (159 lines, contains NumenLogo)
- `src/components/layout/__tests__/header.test.tsx` — FOUND (87 lines)
- Commit `ddabee50` (RED) — FOUND
- Commit `2f7a2e57` (GREEN) — FOUND
