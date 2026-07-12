# HANDOFF — Landing refinement pass (2026-07-12) · session SSOT

> Landing lane session #2 (worktree `~/virtuna-landing-lane`, branch `lane/landing-polish`,
> dev port **3010**). Previous session SSOT: `docs/HANDOFF-2026-07-11-landing-lane.md`.
> Everything below is merged to main and browser-verified.

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

## Next session: real product screenshots into the slots

The slots (all built as one-swap):
| Slot | File | Current filler | Target |
|------|------|----------------|--------|
| Hero window body | `hero/hero.tsx` (the div marked "this block is the `src` slot") | skeleton dashboard | real dashboard/reading screenshot |
| Hero phone screen | `hero/hero.tsx` → `PhoneVideoSkeleton` | faux video UI | real TikTok-style capture or product mobile view |
| Showcase window | `story/simulation-showcase.tsx` window body | flanked skeleton row | real Simulation reading screenshot |
| 4 feature frames | `story/feature-blocks.tsx` FEATURES[].visual | per-feature skeletons | real cropped product views (score, curve, audience, drivers) |
| (later) marquee names, testimonial avatars/quotes, "2,000+ creators" | proof components | plausible set-dressing | real accounts/quotes — **owner call** |

Capture path A (self-serve, no owner assets needed): run the REAL app in a worktree
(trunk `~/virtuna-v1.1` :3000 or this one), auth via the Playwright login flow
(memory: "Numen fixture capture"), open a seeded/demo reading + /start + /audience,
disable animations, capture tight crops at 2× for the exact aspect boxes.
Capture path B: owner drops captures/video into the repo; session wires + art-directs.

Contracts to keep green when swapping: hero test asserts the four skeleton `role=img`
labels + a `/your tiktok/i` text node + `maven.app` pill — swapping fillers for `<img>`/`src`
means updating those assertions in the same commit (same pattern as #230/#241 test updates).
`/simulat/i` noun-locks are component-scoped. Matte guard must stay 38/38.

Beyond screenshots, "make it pop" candidates (owner taste, propose with sketches):
real content density in the frames, a restrained motion pass on the fold, marquee → real
wordmarks, tightened section rhythm. Keep the near-zero-accent dosage rule (DESIGN-SYSTEM).

## Resume

```bash
cd ~/virtuna-landing-lane   # branch lane/landing-polish, synced to main @ 4fa907f5+
tail -f /dev/null | NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3010
```
