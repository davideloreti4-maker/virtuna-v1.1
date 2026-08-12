# Handoff — Phase 2 (the shelf) kickoff · lane/platform-concept

> **Written 2026-08-08 at the end of the Phase-1 implementation session.** Phase 1 (composer
> v8) is BUILT, VERIFIED and PR'd. This doc is the fresh-session kickoff for Phase 2 and
> records the seams Phase 1 left for it plus the traps that cost time this session.
>
> **Precedence chain is unchanged:** `docs/HANDOFF-2026-08-08-concept-v8-implementation.md`
> (SSOT — decisions, build order, cautions) → the spec (revision blocks override body) →
> the mock (layout/anatomy ONLY). This doc ADDS Phase-1 outcomes; it overrides nothing.

## 1. What Phase 1 shipped (and where Phase 2 plugs in)

All behind `CONCEPT_V8_ENABLED` (`src/lib/flags/concept-v8.ts`, env
`NEXT_PUBLIC_CONCEPT_V8=true`, **requires** `NEXT_PUBLIC_AMBIENT_V2=true` — the v8 mounts
live inside the v2 branches). Plan with full task detail:
`docs/superpowers/plans/2026-08-08-composer-v8.md`.

| Piece | Where | Phase-2 relevance |
|---|---|---|
| v8 arrival (greeting only) | `src/components/app/home/v8/arrival.tsx`, mounted at both `AmbientStartHome` swap points in `composer.tsx` (search `CONCEPT_V8_ENABLED ? (` near `<AmbientStartHome`) | **The shelf replaces/extends this.** Drops render here; greeting stays. |
| Chips row | `v8/chips-row.tsx`, rendered after `{composerDock}` in both branches | Sits under the composer; shelf lands above the composer. |
| Sub-bar + RoomOverlay | `v8/sub-bar.tsx` | Drop-card "Simulate" actions (Phase 3) reuse `RoomOverlay`/rail; don't rebuild. |
| Skills panel + pill | `v8/skills-panel.tsx` (real registry; taxonomy naming = owner call §7.6) | Remix-card tap must NOT go through the panel — it seeds a thread directly. |
| Platform lens | `v8/platform-lens.ts` — run-level `platform` override, localStorage-carried | Drops are cached per audience per day; the lens does NOT key the drop cache (spec: lens changes generation prompts only). |
| Max price on model chip | `MAX_BILLABLE_BY_TOOL` in `composer-controls.tsx`, from `CREDIT_COSTS` | Extend the map only when a new Max skill ships. |

## 2. Phase 2 scope (handoff §4.2 — do not re-litigate)

**The shelf**: six remix-first drop cards over the existing daily-surface cache; real
rehosted source stills + view counts; Remix → thread seeded with the 3-angle turn (render
treatment). Single-column mobile, 2-col desktop, composer docked below. Cards arrive
**pre-scored** (the drops are the ONLY pre-scored surface — fire-on-demand rule).

Existing machinery (verified in the prior handoffs — reuse, don't rebuild):
- Corpus: `public.outlier_teardowns` (211 printable rows) + `src/lib/grounding/rank.ts`
  round-robin ("six ways to open" — one per archetype shape).
- Daily cache: `getFreshSurfaceCards` + `src/lib/surfaces/use-lazy-warm.ts` (live on the old
  `/start` build — `src/components/surfaces/start-page.tsx:140,147` shows the call pattern).
  First visit of the day = warming skeletons.
- Remix output: `src/lib/engine/remix/adapt.ts` (Zod `.length(3)`) + `decode.ts`.
- Card anatomy contract: mock §1–§2 (thumb + view count · serif adapted hook · meter ·
  Remix button). Mock content is FABRICATED — hooks/scores/thumbnails are stand-ins.

## 3. Binding constraints that bite Phase 2 specifically

- **No corpus multiplier number anywhere** (owner call #1 unresolved). View count + sim
  score are the only numbers on a card.
- **Donor domain/niche never shown**; curated teardown prose never shown verbatim.
- **Grounded generation has NEVER run** (`GROUNDING_*_ENABLED` off). Flip in sandbox and
  READ the output before building the drops pipe on it (`scripts/preview-grounding-slices.ts`).
- **Drop economics = owner call #3**: six adapt+sim per user per day, cached once/day/
  audience; `BILLING_ENFORCE_QUOTA` live (free tier `limit:0`). Get a real cost number
  before anything ships beyond the flag; do NOT wire the nightly pipe to real users' quota
  without the owner's ruling.
- Thumbnails: REAL rehosted source stills (rehosting pipe may be new build — ask the owner
  before adding scope; Apify stays off the critical path).
- Accent dosage: a drop card gets ZERO accent. The sub-bar live dot stays the only accent.

## 4. Traps hit in the Phase-1 session (avoid re-paying)

1. **`overflow-hidden` on the composer box clips anything absolutely positioned above it** —
   the legacy `/` slash menu is fully invisible on the live path (DOM tests can't see it;
   only the browser probe caught it). v8 portals via `UpwardPopover` (now exported from
   `composer-controls.tsx`). Owner left the LEGACY path unfixed on purpose (v8 supersedes).
   Anything new that floats above the dock: portal it.
2. **Component test files need `/** @vitest-environment happy-dom */` on line 1** — default
   env is node; `window is not defined` otherwise.
3. **Dialog role/testid go on the VISIBLE fixed panel, not a wrapper** — a zero-height
   wrapper around fixed children reads as "hidden" to Playwright visibility checks.
4. **`type-scale.test.ts` guard**: no `text-[Npx]` on rendering surfaces (roles only:
   micro/caption/label/body/reading/title/subhead/heading/stat), fractional px banned
   everywhere. The serif greeting has a documented allowlist entry.
5. **Dev-server reaper** kills idle servers after ~10 min — restart before every probe run.
6. **Signed-in verification**: mint the Supabase cookie via auth REST (memory:
   `signed-in-verification-recipe`); working scripts from this session live in the previous
   session's scratchpad (`mint-auth.mjs`, `shoot-v8.mjs`) — rewrite is ~5 min if gone.
   The e2e user is a REAL PROD account: render/open interactions only, never fire runs.
   One browser context per viewport, opened at size. Never `networkidle`.
7. **Pipes eat exit codes**: `npx vitest run | tail` reports tail's exit — `set -o pipefail`.
8. **`routing-cut.test.ts` fails in THIS worktree only** — caused by the pre-existing
   uncommitted `/start` restore (owner call, handoff §7.2). Do not commit or "fix" those
   two files (`src/app/(app)/start/page.tsx`, `src/components/surfaces/start-page.tsx`).

## 5. State at handoff

- Branch `lane/platform-concept`, Phase-1 commits `ddeaea9c..` + this doc, pushed; PR open
  against `main` (flag-off inert, safe to merge any time; Vercel git is DISCONNECTED per
  memory — merging does not deploy).
- Owner review items riding with the PR: skills-panel taxonomy naming (§7.6),
  direction-grade copy (`PROMISE_BY_TOOL`, chips, panel footer), ≥xl rail + RoomOverlay
  coexistence until Phase 3, legacy slash-menu clip left as-is.
- Gates used all session: `node node_modules/typescript/bin/tsc --noEmit` · `npm run build`
  · `npx vitest run` (with pipefail).

## 6. Kickoff prompt for the fresh Phase-2 session

```
Phase-2 implementation session for platform concept v8, worktree
~/virtuna-platform-concept (branch lane/platform-concept — pull first, Phase 1 is merged
or in PR).

Read, in order:
1. docs/HANDOFF-2026-08-08-composer-v8-phase-2-kickoff.md  (Phase-1 seams, traps, scope)
2. docs/HANDOFF-2026-08-08-concept-v8-implementation.md    (SSOT — decisions, cautions §5–7)
3. docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md  (spec — revision
   blocks at the top override the body; §1 is the shelf)
4. docs/mockups/concept-v2-2026-08-08.html §1–§2  (drop-card anatomy ONLY — content is
   fabricated)

The concept is SETTLED — do not re-litigate. Build Phase 2 (the shelf) behind the existing
CONCEPT_V8_ENABLED flag: six remix-first drop cards over the existing daily-surface cache
(getFreshSurfaceCards + use-lazy-warm + rank.ts round-robin), real rehosted stills + view
counts, Remix → thread seeded with the 3-angle adapt.ts turn. Plan it first
(superpowers:writing-plans), then build TDD, then verify signed-in in a real browser at
393×852 and 1440×900 (render-only — the e2e user is a real prod account).

Hard rules: no corpus multiplier numbers; donor niche never shown; drops are the ONLY
pre-scored surface (generation never auto-simulates); zero accent on cards; flag-off stays
byte-identical. Before building the drops pipe on grounded generation, flip
GROUNDING_* in sandbox and read the output (scripts/preview-grounding-slices.ts). Drop
economics and the rehosting pipe are OPEN OWNER CALLS — ask before wiring real quota or
adding a scraper. Gates before any push: tsc --noEmit, npm run build, vitest (pipefail).
Never commit the two uncommitted /start files.
```
