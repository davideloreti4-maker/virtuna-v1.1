# Handoff — /start composer + New-thread + ambient-audience redesign (2026-07-07)

**Branch:** `lane/explore-b` → merged to `main` (this session).
**Worktree:** `~/virtuna-explore-b`, dev server on **:3002**
(`NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002`).

## What shipped

All verified live in the browser (desktop 1440 + mobile 390) and `tsc` clean.

### /start page
- **Composer matches /home** — `EmbeddedComposer` restyled to the /home two-row layout
  (full-width field on top; `✦ Verb ▾` pill left, `+` attach + cream send right).
  Paperclip → Plus. `src/components/app/home/embedded-composer.tsx`.
- **Removed the ambient-audience dock** (`SurfaceDock`) above the /start composer, and made
  the docked-composer backdrop **transparent + click-through** so page content shows behind it.
  Removed the now-dead audience-switch handler + its state/regex. `src/components/surfaces/start-page.tsx`.
- **"New thread" button** in the greeting header, **left of the metric rings**, `#1a1a19` bg,
  `h-10` top-aligned to the ring glyphs. Mirrors the sidebar's `handleNewThread`
  (`useCreateThread` → `switchThread` → `router.push("/home")`) → lands on the blank /home
  thread with the HomeStarter quick actions (Test an idea · Profile a chat · Predict an outcome).
- **Rings align to the card grid**: the header cluster is `shrink-0` so the greeting yields
  space instead of the rings overflowing past the stat-card right edge.

### /home ambient audience (the big one)
Unified the audience presence into **one docked card at every breakpoint** — the old ≥xl
fixed 392px right rail is **retired**.
- Dropped `railPortal` + `isDesktopRail` + the `xl:hidden` gate (composer.tsx) and the
  `xl:pr-[392px]` reservation (home-page-layout.tsx). Removed now-unused `createPortal` /
  `useMediaQuery` imports.
- **Collapsed** = a tab **connected to the composer top**: narrower than the composer (inset
  both sides via `px-4`), no gap, **rounded top corners only, square bottom flush** into the
  composer (`border-b-0`), darker `#1a1a19` (`--color-surface`) vs the composer's `#2c2c2b`.
- **Open** = blooms upward into one connected surface: the **switcher/identity bar is at the
  TOP** of the expanded card; panel bottom is flush with the composer (composer box flattens
  its top: `audienceOpen && "rounded-t-none border-t-0"`). Switcher dropdown opens **downward**
  when at the panel top.
- **Opens on the ranked OVERVIEW** ("How the room ranked your N"), not a card's personas.
  Tapping a row drills into that concept. Fix keys off a **real focusId change**
  (`compareFocusRef` seeded to the initial focusId) — a plain mount-skip flag was defeated by
  React StrictMode's double-invoked effects. `AmbientRoom.tsx`.

Files: `src/components/audience-lens/audience-presence.tsx`,
`src/components/audience-lens/AmbientRoom.tsx`,
`src/components/app/home/composer.tsx`, `src/components/app/home/home-page-layout.tsx`.

## Commits (9)
`e7bb2cf6` start composer match · `9d7628af` New-thread button · `23820579` button left+bg ·
`425e0567` button top-align · `58bbd8fb` rings grid-align · `f6fdf7db` audience unify ·
`0b8f6997` darker cap · `dafb5514` audience redesign (chip+top-switcher+overview) ·
`fa159806` connected tab.

## Open follow-ups (NOT done)
- **Dead `layout="rail"` code** in `audience-presence.tsx` (~lines 517–611) is now unreachable
  (nothing renders `layout="rail"` after the unify). Harmless dead code — left in intentionally
  to keep the ship low-risk. Safe to delete in a focused pass + tsc/browser verify.
- `SurfaceDock` (`src/components/surfaces/surface-dock.tsx`) is no longer rendered anywhere
  after /start dropped it — candidate for deletion too.

## Resume checklist (fresh session)
1. `cd ~/virtuna-explore-b && git switch lane/explore-b && git pull` (or work off `main`).
2. Dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002`.
   If deps missing / build errors: `git reset --hard origin/main && pnpm install` first.
3. Verify UI in a real browser (vitest can't catch client/server bundle leaks).
