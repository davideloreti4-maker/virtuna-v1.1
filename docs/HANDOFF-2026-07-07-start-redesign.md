# Handoff — /start redesign + dark panel surface (2026-07-07)

**Worktree:** `~/virtuna-explore-b` · **Branch:** `lane/explore-b` · **Dev:** `http://localhost:3000`
**Resume:** `pnpm install` (this worktree was missing `@upstash/*` deps → build error; now installed), then
`NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack`.

## What shipped this session (Stanley-inspired `/start` refit + platform dark panels)

Driven by side-by-side comparison with Stanley (getstanley.ai) — "less is more," premium, no AI slop.

### `/start` (flagship) — `src/components/surfaces/start-page.tsx` + `sections/*`
- **Rail 7 → 3–4 widgets.** Calendar · Your plan · Quick actions. Removed Content pillars from
  /start (it lives on `/grow`, the Analyze hub); the pillar-confirm card + list de-duplicated.
- **The Loop** moved out of the crowded rail → a closing full-width band at the bottom of the
  main column (who-you-are → numbers → ideas → outliers → what-landed).
- **Rail scrolls with the page** (was `lg:sticky` + inner `overflow-y-auto` → plain column).
- **De-boxed:** removed the muddy `#252320` section wrappers; sections breathe on the page bg
  with generous rhythm (`space-y-8 lg:space-y-10`), Stanley-style.
- **Greeting:** bigger serif hero (34/42px); **killed the AI-slop subtitle** (`mock-room.ts` line "").
- **Rings → Score · Streak · Growth** with legible labels (`greeting-rings.tsx`, `mock-room.ts`).
  Terracotta arc kept on Score only (design's single-accent rule).
- **Removed** the top layout + theme buttons (`TopChrome` — no-op toasts; component file now unused).
- **Stat row → Stanley's 4 metrics:** Views · Likes · New followers · Posts (dropped the vanity
  Followers total; `account-metrics.ts` `buildAccountStats` + tests updated). Bigger numbers, more
  padding, dashed baseline instead of the repeated "trend builds daily" slop.
- **Outlier frames → real 9:16 reels** (`outlier-card.tsx`/`outliers.tsx`), roomier mobile width.

### Sidebar — `src/components/sidebar/Sidebar.tsx`
- Kept as the chat-history surface but stripped the untitled "New chat" placeholder noise
  (keeps the newest for the active-row highlight; caps 12).

### Mobile
- Fixed the floating hamburger overlapping the greeting (`pt-16 md:pt-10`). No horizontal overflow.

### Dark panel surface — NEW token `--color-surface-sunken: #1a1a19` (`globals.css`)
The dark "modal/well" tone (from the Claude-projects reference), applied to the full-width
**section panels + info banners** ONLY:
- `/start` outcome banner (`outcome-capture.tsx`)
- `/calendar` month grid (`calendar/month-grid.tsx`)
- `/grow` (`grow-view.tsx` ×3), Referrals (`referrals-tab.tsx` ×4), Analytics (`analytics-view.tsx` ×2)
- Also repointed `--color-charcoal-composer` → `#1a1a19` (the surface/composer card).

**Cards / sidebar / app bg stayed original** (`#2c2c2b` / `#1f1f1e`) — the owner iterated to
"only the panels dark," not a full re-tone. A near-black re-tone was tried and reverted.

## Verified
- Live at 1512×950 (desktop) + 390×844 (mobile): /start, /calendar, /feed, /audience — 0 console errors.
- `tsc --noEmit` clean · reskin-matte guard 39/39 · account-metrics 19/19 · sidebar 19/19.

## Notes / follow-ups
- `@upstash/ratelimit` + `@upstash/redis` were installed via **pnpm** in this worktree (they're in
  package.json but weren't in node_modules → dev build error). recharts synced to pinned 3.9.1.
- Dead file: `src/components/surfaces/sections/top-chrome.tsx` is now unused — safe to delete.
- The auto-wip daemon committed some of this work mid-session (chore(auto-wip) commits on the branch);
  content is intact. Don't reset/force-push under it.
- Owner declined darkening content cards / app bg — if revisited, that's a coherent tiered dark
  re-tone (bg → sunken → card), not a single flat color (nested cards need contrast).
