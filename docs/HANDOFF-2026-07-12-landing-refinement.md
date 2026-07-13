# HANDOFF — Landing refinement + real screenshots (2026-07-12 → 07-13) · lane SSOT

> Landing lane sessions #2–#3 (worktree `~/virtuna-landing-lane`, branch `lane/landing-polish`,
> dev port **3010**). Previous session SSOT: `docs/HANDOFF-2026-07-11-landing-lane.md`.
> Everything below is merged to main and browser-verified.
>
> **STATUS: lane CLOSED 2026-07-13** — the template-feel gap is fixed (PR #261: real app
> screenshots in every slot). Worktree removed; branch `lane/landing-polish` retained on origin.
> Jump to [✅ DONE — real product screenshots](#-done--real-product-screenshots-into-the-slots--pr-261-squash-cc9c5787-2026-07-13)
> and [Lane closed](#lane-closed-2026-07-13).

## What shipped — PR #241 (squash `4fa907f5`, MERGED)

Design/UX refinement pass closing every non-owner-gated backlog row:

1. **`PhoneVideoSkeleton`** (new, `story/skeletons/phone-video-skeleton.tsx`) — the hero
   phone's bare "Your TikTok" void is now a vertical-video shape: label pill, 3-dot action
   rail, handle + caption bars, seek bar. Accent-FREE by design (the fold's coral stays in
   the Simulation window = the OUTPUT). Phone seats deeper (`sm:right-10`, `w-[17.5%]`) so
   it overlaps the window corner.
2. **Caption dedupe** — `RetentionCurveSkeleton` gained `showDropCaption` (default true);
   hero passes `false` so "drops at 0:07" appears once (drivers row keeps it).
   `AudienceCloudSkeleton` gained `showCaption` (default true) for the CTA-band echo.
3. **How-it-works step 1** — murky phone-bezel mock → `PasteLinkRow` (in `how-it-works.tsx`):
   focused URL input, mono `tiktok.com/@you/video/72…`, static caret, dimmed ghost row.
4. **Simulation showcase** — lone centered gauge → flanked instrument row on md+
   (`md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)]`: cloud | gauge | drivers); mobile
   hides the cloud (hero GAP-2 pattern) so the capped window keeps gauge + drivers.
5. **Feature 1** — `ScoreWithWhy` (in `feature-blocks.tsx`): gauge + three mini why-bars
   (no coral, no captions — deliberately lighter than row-4's full DriverRowsSkeleton).
6. **Final CTA band** — gauge echo (5th appearance) → `AudienceCloudSkeleton` caption-off;
   matches the close-line "Your audience already knows." Gauge page-wide 5×→3×.
7. **Pricing** — Starter CTA → `secondary`, Pro keeps the lone `primary`; highlighted card
   gains `bg-surface` tone-step; CTA cluster `mt-auto`-pinned to a shared baseline.
8. **Testimonials** — Placeholder bust icons → initials monograms (MC/JE/PS). Keeps the
   `data-variant="avatar"` hook the PROOF-02 test counts.

**Verification:** marketing 72→**76/76** (+4 new tests: PhoneVideoSkeleton, caption modes) ·
reskin-matte 38/38 · tsc 0 · eslint 0 · browser 1440+390 all sections · 0 overflow.
Screenshot archive `.playwright-mcp/landing-2026-07-12/` (gitignored).

## ⚠️ Incident: PR #240 merged EMPTY (main undamaged) — the hook gotcha

**`21a6eb5a` on main is an empty noise commit** (`git diff 7148c1c5..21a6eb5a` = empty).
Chain: after `git reset --hard origin/main` on the lane (whose remote still held the
pre-squash #230 commits), the next commit's **auto-push post-commit hook was rejected
(non-fast-forward) and failed SILENTLY** → `origin/lane/landing-polish` stayed stale →
`gh pr create` cut #240 from the OLD tip (already-merged #230 content) → squash = no-op.
The real commit survived only in the local reflog.

**Recovery (worked):** `git reset --hard <reflog-sha>` → `git rebase origin/main` →
`git push --force-with-lease` → PR #241 → verify `changedFiles` matches → merge.

**Rules going forward:**
- Before `gh pr create`: `git rev-parse origin/<branch> HEAD` must match.
- After any lane reset onto a squash-merged main: `git push --force-with-lease` the lane
  branch as part of the reset.
- Before `gh pr merge`: check the PR's file/±line counts against your local commit.

## Dev-server gotchas (this worktree, port 3010)

- `next dev` **exits 0 on stdin EOF** in background shells → launch with stdin held open:
  `tail -f /dev/null | NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3010`
- After a git-reset content swap the running server **serves STALE modules** (no recompile)
  → `rm -rf .next` + restart, then confirm a content marker via curl before trusting the browser.
- Playwright: inject `*{animation:none!important;transition:none!important}` pre-capture;
  `fullPage` doesn't scroll (whileInView sections = empty voids — do a stepped scrollTo sweep
  first); MCP screenshots land in the repo ROOT — move to `.playwright-mcp/<archive>/`.

## UAT verdict (owner, 2026-07-12) — the real gap

`docs/UAT-2026-07-12-landing-refinement.md` (status: partial — 1 pass-with-note, 7 skipped).

> "Looks better, but the page still reads like a **template** — it doesn't pop.
> It needs **real UI pictures from the actual app** to look real and good."

Skeleton set-dressing has hit its ceiling. **Next step (owner-confirmed): capture real
product UI and swap it into the slots.**

## ✅ DONE — real product screenshots into the slots · PR #261 (squash `cc9c5787`, 2026-07-13)

The skeletons are gone from the marketing page. Every product slot holds a REAL 2× capture of
the running app, in `public/images/landing/`:

| Slot | File | Now shows |
|------|------|-----------|
| Hero window body | `hero/hero.tsx` | `hero-read.png` — the thread rail + a reading: score **71 Strong**, 62% watch-through, biggest drop 0:08, the push-stage chart |
| Hero phone screen | `hero/hero.tsx` | `phone-thread.png` — Maven on mobile: a hook card, scored Strong 7/10 stopped, the room's quote |
| Showcase window | `story/simulation-showcase.tsx` | `showcase-read.png` — the reading in full: score → push stages → the levers |
| Feature 1 "Know before you post" | `story/feature-blocks.tsx` | `feature-hook.png` — a hook card: the score AND the why beside it |
| Feature 2 "See exactly where viewers drop" | ″ | `feature-retention.png` — the retention curve opened on its drop (−24% @ 0:06) |
| Feature 3 "Understand your audience" | ″ | `feature-audience.png` — the people in the room and what they said |
| Feature 4 "Fix the weakest lever" | ″ | `feature-drivers.png` — the three levers side by side |
| (still owner-gated) marquee names, testimonial avatars/quotes, "2,000+ creators", pricing numbers | proof / pricing components | UNCHANGED — plausible set-dressing until the owner decides |

Each feature row shows a **different** surface on purpose, so the four frames read as one product
seen from four angles instead of the same instrument four times. Slots render through `next/image`
inside aspect-locked boxes (no CLS); the hero capture is `priority` (it is the LCP element). Device
chrome / shadows / warm seat unchanged — only the bodies swapped. Near-zero accent dosage holds:
the only colour inside a frame is the product's own semantic banding (green score, amber drop).

`FeatureBlock` changed shape: it now takes `src` + `alt` instead of a `visual: ReactNode`.
The skeleton primitives still exist and are still tested, but the only live consumer left is the
final-CTA audience-cloud echo (`cta/final-cta-band.tsx`) — an abstract motif, not a fake frame.

### Capture recipe (reuse this — it is the cheap part)

`/dev/cards` is the best source: it renders every skill card 1:1 with the REAL components.

- Auth via Playwright (`e2e-test@virtuna.local`), then `goto /dev/cards`.
- `chromium.launch({ channel: "chrome" })` — this repo has **only `@playwright/test`** and no
  downloaded browser binaries; system Chrome avoids a large download.
- `deviceScaleFactor: 2`; inject `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}` + `nextjs-portal{display:none!important}`.
- **Scroll the inner `<main class="relative h-full overflow-auto">`, NOT `window`** — the app shell
  scrolls internally, so `window.scrollTo` silently does nothing.
- **The driver rows EXPAND, and that is where the good visuals are**: Retention opens into the real
  drop-curve scrubber ("Drag to replay the drop"), Shareability into share/completion/comment/save
  tiles. A collapsed reading looks far thinner than the product actually is.
- **Hide the dev-gallery captions before shooting** — `/dev/cards` prints monospace demo labels
  ("Your 4 people", "REPLAY IN TIMELINE — THE ROOM REACTS…", section titles like "Test / Reading").
  They WILL ship onto the marketing page otherwise (caught twice in v1/v3 crops).
- Crop each shot to the frame's own ratio (16:10 here) so `object-cover` never actually crops.

Demo data was rich enough with no seeding: the e2e user has 60 threads / 48 analysis results / 4
audiences. The owner's "seed a good reading first?" question resolved itself.

### Test contracts (moved in the same commit)

The hero + showcase gates asserted skeleton `role=img` labels (`/virality score/i`, `/retention
curve/i`, …), a `/your tiktok/i` node, and an svg/circle structural fingerprint — none of which
exist any more. They now assert the captures by accessible name + the aspect-locked box;
`feature-blocks` gained a "every frame holds a named screenshot" gate.
Marketing **78/78** · matte guard **38/38** · `tsc` 0 · `eslint` 0 · browser-verified 1440 + 390
(all 7 captures load, no horizontal overflow, no console errors).

### Known limitation (owner's call)

At **390px the desktop crops shrink to texture** — you can tell it is a real product, but you cannot
read it. This is the industry norm (Linear/Vercel do the same). The fix, if wanted, is a
mobile-specific crop set (tighter regions) swapped in with `md:hidden` / `hidden md:block`.

## Lane closed (2026-07-13)

The screenshot session was the last item in this lane's brief. `lane/landing-polish` is merged and
reset onto `origin/main` @ `cc9c5787`; the worktree `~/virtuna-landing-lane` was removed. Nothing is
stranded (clean tree, 0 ahead / 0 behind at close; the 4 repo stashes all predate this lane).

To reopen landing work, re-create the worktree from main:

```bash
git worktree add ~/virtuna-landing-lane lane/landing-polish   # branch still exists on origin
cd ~/virtuna-landing-lane && git reset --hard origin/main
tail -f /dev/null | NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3010
```

Remaining owner-gated items: pricing numbers ($19 vs $29/$49/$129), the "2,000+ creators" claim,
real marquee/testimonial identities, public domain + SSO wall + prod smoke.
