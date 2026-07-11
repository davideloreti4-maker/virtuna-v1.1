# HANDOFF — Landing lane (2026-07-11) · shipped-state SSOT

> Session: trunk-launched Fable session running parallel to explore-a/b/c (all four got the same
> audit prompt). This session claimed the **marketing/landing surface** — the one lane no other
> session owned — in its own worktree. Everything below is shipped and live-verified.

## What shipped — PR #230 (squash `0b34680a`, MERGED + auto-deployed)

1. **Hero window = product-skeleton dashboard** (`src/components/marketing/hero/hero.tsx`)
   The fold's product shot was a bare 16/10 `Placeholder` ("Maven Simulation" label on an empty
   charcoal void) — the weakest moment on the page, at first paint. The window body now renders a
   dashboard composed from the existing `story/skeletons` primitives: **DriverRows + RetentionCurve
   as the main column, ScoreGauge + AudienceCloud as a right rail** — deliberately a *different
   composition* from The Simulation section's stacked frame so the two windows don't repeat.
   - Height-capped `max-h-[520px] overflow-hidden` (GAP-2 pattern from simulation-showcase).
   - Mobile: rail first in DOM so the crop keeps gauge + drivers; **cloud is `hidden md:flex`**
     (at full mobile width the 100×90 viewBox grows ~270px tall and eats the window).
   - Still swappable for a real screenshot later (FOUND-03) — the dashboard block IS the `src` slot.
2. **`numen.app` → `maven.app`** (`story/skeletons/device-chrome.tsx`)
   BrowserChrome's address pill was missed by the Numen→Maven rename (#203) and rendered in all
   four feature-block frames. Verified live: 6/6 pills on the page now read `maven.app`.
3. **Backlog §1 reconciled** (`docs/OPEN-WORK-BACKLOG.md`)
   §1 still claimed "prod serves the Jan-27 init commit / deploy = THE launch blocker". Rewritten
   to verified reality (see Deployment below).
4. **Tests updated to the new contract** — the hero OUTPUT test asserts the four skeleton
   `role=img` labels (was: the removed placeholder label); the BrowserChrome test asserts
   `maven.app`. Note: hero tests live in `hero/__tests__/`, NOT `marketing/__tests__/`.

**Verification:** tsc 0 · eslint 0 · marketing 72/72 · reskin-matte 38/38 · 0 console errors ·
0 horizontal overflow (1440 + 390) · browser-verified locally pre-merge AND on the deployed
production build post-merge (full-page + fold + mobile; markers: `numen.app` 0, old label 0,
skeleton labels present). Screenshot archive: `.playwright-mcp/landing-2026-07-11/`
(before/after/prod, gitignored).

## Deployment state (the audit's headline finding)

- **Vercel GitHub integration is LIVE — every merge to `main` auto-deploys to production.**
  Verified via Vercel MCP: production deployment for `0b34680a` READY; ~20 consecutive READY
  deploys, zero failures. The old "prod stuck at Jan-27" launch-gate item was stale (so was the
  "prod DB stuck at Jan-27 schema" fear — migrations have been MCP-applied to prod throughout).
- ⚠️ **Prod is Vercel-SSO-walled**: `virtuna-v11-git-main-davide-loretis-projects.vercel.app`
  serves a Vercel login page to the public. Content was verified via a temporary
  `get_access_to_vercel_url` bypass link. **The real launch gate is now: attach a public domain
  (or disable deployment protection on production) + set runtime env vars (engine keys:
  `DASHSCOPE_API_KEY`, `APIFY_TOKEN`, …) + one prod smoke (sign in → run a skill).**

## Parallel-session lane protocol (what worked)

- 4 sessions, zero collisions: **a** (explore-a → thread-cards #228), **b/c** (their lanes →
  #229/#231/#232), **this one** (landing). Main moved 6 commits mid-session; no file overlap.
- Claim mechanism: `git worktree list` + freshest remote branches = the live claims board; a new
  lane = create worktree + branch immediately (auto-push hook makes it visible to everyone).
  One session ↔ one worktree ↔ one branch; kill your dev server when done.
- This lane: worktree `~/virtuna-landing-lane`, branch `lane/landing-polish` (merged; safe to
  delete or keep for the next landing pass), dev port **3010**.

## Gotchas (cost something to learn)

- **Playwright screenshots on this app:** inject
  `*,*::before,*::after{animation:none!important;transition:none!important}` before capturing —
  the stability wait otherwise hangs (CLAUDE.md gotcha, confirmed on the marketing marquee too).
- **`fullPage` screenshots don't scroll** → `whileInView` sections capture as EMPTY voids and the
  page looks broken when it isn't. Do a stepped `scrollTo` sweep first, then capture.
- **Playwright-MCP screenshots land in the repo root** (`~/virtuna-v1.1/`) — move them out
  (root-files rule). Archive folder used here: `.playwright-mcp/landing-2026-07-11/`.
- The `/simulat/i` noun-lock tests are **component-scoped** (showcase, how-it-works) — adding
  "Simulation"-adjacent text in other marketing components is safe.

## Open items on this lane (next session)

| Item | Notes | Gate |
|------|-------|------|
| Real product screenshots / demo video into the `src` slots | hero window + phone, showcase, 4 feature frames — the skeletons are deliberately swappable one-prop slots | **owner assets** |
| Phone slot faux-video treatment | "Your TikTok" placeholder is honest but bare; a vertical-video skeleton (hook bar + action rail) would finish the fold | design call |
| Skeleton repetition | gauge appears ~5× page-wide (hero, step-3, showcase, feature-1, final CTA) — fine pre-assets, real screenshots will fix | with assets |
| "drops at 0:07" ×2 in the hero window | drivers caption + curve caption, same fact two views — accepted; a `caption` prop on RetentionCurveSkeleton would dedupe | nit |
| **Pricing discrepancy** | landing shows Starter Free / **Pro $19**; pricing-strategy memory says $29/$49/$129 | **owner call pre-launch** |
| "Join 2,000+ creators" claim | pre-launch social proof copy | owner call |
| Public domain / deployment protection | see Deployment above | **owner, launch gate** |

## Resume

```bash
cd ~/virtuna-landing-lane   # or branch fresh off origin/main
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3010
```
