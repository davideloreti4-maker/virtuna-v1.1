# Handoff — Ambient-audience fixes + coral-red accent (2026-07-07)

**Branch:** `lane/explore-b` (worktree `~/virtuna-explore-b`, dev on :3002)
**Pushed:** `origin/lane/explore-b` @ `f830c799` (2 commits on top of `cb0fe431`)
**Status:** all work verified live; NOT merged. ⚠️ `origin/main` moved 2 commits ahead with **overlapping files** — rebase/merge is the first step next session (see §Rebase).

## What shipped (verified)

1. **Accent → `#FF6363`** (`feat(brand)` `c5328fcc`) — `globals.css` `--color-accent` + hover/active/text/soft/transparent retuned from terracotta `#d97757` to coral-red. `coral-*` scale left intact.
2. **Maven mark = accent** — `MavenMark` defaults to `text-[var(--color-accent)]`; the gull renders coral-red everywhere (placements can override via className). ⚠️ this also reddens the mark on **marketing** surfaces (header/footer/onboarding) whose comments said "cream" — verify that's wanted, or scope the default to app-only (sidebar/greeting/command-bar).
3. **Audience selector = skill pill** — the "General" switcher uses `bg-surface` (#1a1a19) + `white/[0.06]` border, matching the "Make" pill.
4. **Home dock** — composer card + ambient-audience card stay **opaque** (`surface-elevated`); the dock **wrapper** is a transparent, `pointer-events-none` overlay (`absolute inset-x-0 bottom-0`), the thread region is full-height with `pb-[184px]`, so **chat scrolls behind** the floating cards. `composer.tsx` `composerDock` + the `homeThreadMode` return.
5. **"See the room" → current audience (the reported bug)** (`feat(audience)` `f830c799`) — was opening a standalone per-card `AudienceLens` seeded with placeholder `viewer 1..10 / New viewers`. Now `ProofUnit` reads a new `OpenRoomContext` (from `composer.tsx` `openRoomForCard`, resolves card by concept text → `focusByTap` → opens docked presence). Off-composer (calendar/saved/library) the context is null → keeps the standalone Lens.
6. **Drill-in** — `AmbientRoom.initialCompareOpen` + `AudiencePresence.drillIntoFocus` + composer `roomDrill`: a card's "See the room" drills straight into that card's people (`‹ Hook N of M ›` stepper); a plain tab-tap still lands on the ranked overview.
7. **Arrival count-up fixed** — root cause: `AudiencePresence` **remounts** across the empty→thread layout switch, resetting the mount-seeded `useRef` and swallowing the `reacting` true→false edge (badge never fired). Fix: edge detection moved into **`Composer`** (stable) → bumps `arrivalNonce` → presence drives the count-up off the nonce. **Verified live**: badge ticks `✦1→✦10 new`, holds until the Room opens.

## Verification

- `tsc --noEmit`: clean.
- `audience-presence.test.tsx`: 41/43 (the **2 failures pre-exist** on clean tree — "mounts the v6 Room body…" + "…read-only Room" — unrelated; they assert the people⇄population toggle which only shows drilled-in, not on the default overview).
- thread + home suites: green. Count-up tests rewritten to the `arrivalNonce` contract.
- Live: 2 real hooks generations (`gym beginner mistakes`, `morning routine myths`) — see-the-room drill-in shows named personas (Maya/Theo/Nadia/Elena); count-up fired 1→10.

## Files touched
`src/app/globals.css` · `src/components/brand/maven-logo.tsx` · `src/components/app/home/composer.tsx` · `src/components/audience-lens/audience-presence.tsx` · `src/components/audience-lens/AmbientRoom.tsx` · `src/components/thread/proof-unit.tsx` · `src/lib/hook-test-context.tsx` (new `OpenRoomContext`) · `src/components/audience-lens/__tests__/audience-presence.test.tsx`

## Rebase (DO FIRST next session)
`origin/main` advanced by 2: `d9b3c70f fix(thread): faithful history/restore + chat-surface scroll (#210)` and `282704d7 feat(calendar): real drag/tap planner`. **Overlap risk:**
- **`composer.tsx`** — #210 rewrote ~144 lines incl. the **thread-region scroll**, the same area as the floating-dock change (§4). Expect a conflict here; after resolving, re-verify chat scrolls behind the dock AND #210's scroll/restore behavior both still work.
- **`Sidebar.tsx`** — #210 touched it (renders `MavenMark`); confirm the red mark still looks right.
- **`reskin-matte.test.ts`** — both branches touched; reconcile.

Steps: `git rebase origin/main` (or merge), resolve `composer.tsx`, re-run `tsc` + the audience/thread/home tests + a browser pass on :3002, then push.

## Ship
Open PR `lane/explore-b → main`, **review the accent/red-logo on the Vercel preview** (broad brand change — includes marketing), then merge. Functional fixes are safe; the brand change is the only judgment call.
