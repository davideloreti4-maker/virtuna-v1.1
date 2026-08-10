# HANDOFF — /trial landing: full visual review vs references, then rework to production-usable

**Written 2026-08-10, after PR #459 merged.** The next session's mission, its constraints, the
file map, the audit harness, and everything this lane learned the hard way.

## The mission (owner's words, condensed)

Review the complete `/trial` page **visually** — screenshot it, don't read the code and guess —
compare it honestly against **Attio, Linear, and Sandcastles AI** (secondary: genviral, makeugc),
then rework and refine it into **something we can actually use**. UI design is the whole scope:
layout, type, spacing, depth, component quality, micro-interactions, responsive behaviour.

**What stays placeholder — this is locked:** copy (shaped-but-fake is fine), video/demo/pictures
(the `Slot` + sketch system). Everything else gets optimized. Do not spend the session writing
copy or sourcing assets.

## State at handoff

- `/trial` is **on main** (PR #459, merge `04e4c814`), prerenders static, **NOT deployed** —
  Vercel git is disconnected (2026-08-08), merging does not deploy.
- Built in the `virtuna-landing` worktree on `feat/landing-trial` (safe to keep using; branch is
  merged, so start a fresh branch off main for the rework).
- Gates at merge: tsc clean, prod build clean, 5,648 vitest green, 4 viewports (1440/1512/768/390)
  zero overflow + zero console errors.
- Three sessions of iteration so far: build → "too much standard text" pass (copy −50%, data
  artifacts, sketches) → media pass (demo stage, play affordances) → depth pass (elevation,
  washes, greeked logos, final-CTA curve reprise).

## File map

Everything lives in exactly two trees — nothing else on the page:

```
src/app/(landing)/
  layout.tsx        route-group isolation + per-group fonts (Schibsted Grotesk,
                    JetBrains Mono, Newsreader italic; Inter deduped with root)
  landing.css       ALL page tokens under .lp — surfaces, type roles, .lp-elevate,
                    .lp-chip, reveal/draw animations, reduced-motion kill-switch
  trial/page.tsx    section order (the argument: claim → credibility → pain →
                    mechanism → capability → proof → voices → price → risk →
                    objections → person → ask)

src/components/landing/
  slot.tsx          THE placeholder primitive — variants, play/duration marks,
                    sketch children, corner caption chips
  sketch.tsx        faux-UI skeletons (PlayerSketch, VerdictSketch, ComposerSketch,
                    RoomSketch, ScoreSketch) — hairlines + white-alpha only
  retention-curve.tsx  the SIGNATURE (hero curve + receipt sparklines)
  section.tsx       Section (full-bleed hairline + rhythm + heading block) + Card
  cta.tsx           PRIMARY_CTA / SECONDARY_CTA / TRIAL_MICROCOPY — the only place
                    destinations are written
  reveal.tsx        scroll reveal — server HTML stays visible; arming is client-side
  nav.tsx, sticky-bar.tsx, brand.tsx, hero.tsx
  sections/         logos, problem, how-it-works, features, proof, testimonials,
                    pricing, guarantee, faq, closing (FounderNote/FinalCta/Footer)
```

## The audit harness (committed, use it)

```bash
# dev server (one per port; the launchd reaper kills idle dev servers ~10 min)
cd ~/virtuna-landing && npm run dev -- --port 3007

node scripts/landing-audit/shoot.mjs     # 4 viewports: fold + full + overflow probe + console
node scripts/landing-audit/sections.mjs  # every section as its own image, natural scale
```

Harness rules it encodes (each cost real debugging time): one browser context per viewport;
`reducedMotion: 'reduce'` (reveals otherwise shoot at opacity 0); the Next dev badge hidden (it
files as a fake UI bug); a DOM overflow probe (believe IT, not the screenshot — ancestors clip).
**Audit the final state on a prod build** (`npm run build && npm start -- --port 3007`).

## Locked constraints — violating these is a regression, not a taste choice

1. **Accent budget: coral has exactly four jobs** — primary CTA fills, the hero curve's drop
   segment, the pricing card's lit border, receipt delta arrows. A fifth use must retire one.
2. **Matte, never glow/glass** — depth = directional shadow (`.lp-elevate`, focal objects ONLY:
   demo stage, its floats, retention-read window, pricing card) + neutral cream washes
   (vertical outset only — horizontal outsets bled the viewport at breakpoint edges).
3. **Serif budget: 4 phrases** (hero, pricing H2, guarantee, final CTA). Scarcity = signature.
4. **No half-pixel font sizes** — `type-scale.test.ts` greps ALL of src/ and fails the suite.
5. **Type hierarchy is bimodal** — big display (Schibsted) vs small dense data text
   (`.lp-card-title` 15px / `.lp-card-body` 13px / mono chips). Nothing mid-size in cards;
   `lp-lead`/`lp-body` are for section leads only.
6. **Pricing numbers come from `lib/pricing`** — never hardcode what a card gets charged against.
7. **Server HTML must stay visible without JS** — Reveal arms client-side; keep it that way.
8. **CTA hrefs stay as-is** (`/signup?plan=pro&trial=1&next=checkout`, `/go`); `/terms` +
   `/privacy` don't exist (footer links are `prefetch={false}` on purpose).

## Where the last session judged the page weakest (start of the target list, not the end)

- **Micro-interactions are near-zero.** Cards have a border/tone hover and CTAs a scale tick —
  nothing else responds. The references' premium feel is half hover states, cursor affordances,
  and small transitions. Biggest single gap.
- **Stat bar** is a plain divided row; **receipts** improved but the sparkline panels are boxy.
- **How-it-works sketches** are static compositions — fine, but the weakest of the sketch set
  (compare PlayerSketch's density).
- **Nav** is functional, not designed: no active-section state, no scroll progress, h-16 default.
- **FAQ/founder/footer** are clean but generic — no signature anywhere in the closing act.
- **Section rhythm is uniform** — every section same vertical breath; references vary density.
- **Testimonial wall** is CSS columns with uniform cards — no density variation, no pull-quote.
- Mobile is correct but unloved: floats hidden, stage at 21/9 gets small; consider a
  mobile-specific stage treatment.

## Hard-won lessons (don't relearn)

- A verdict-view frame in the hero **duplicates the signature curve** — that's why the hero
  stage is a demo VIDEO (PlayerSketch), not a product screenshot. Keep the distinction.
- Placeholder ≠ void: dashed boxes read as wireframe, empty frames read as broken. Slots are
  finished surfaces + sketches + labeled corner chips. If you add a frame, give it a sketch.
- 7+1 logo orphan reads as a rendering bug (hence 6); boxed logo slots read as broken embeds
  (hence greeked wordmark silhouettes).
- Two coral CTAs visible at once on phones reads pushy — nav CTA hides <md; hero + sticky bar
  carry the ask there.
- `main` moves fast under you (57 commits during one session). `git fetch` + re-measure before
  branching AND before merging; re-run the FULL gates on the merged tree (main added 188 tests
  mid-session here).
- Trunk pull can be blocked by untracked docs another session committed — diff before removing;
  identical → rm, different → back up first.

## Definition of done for the rework

Screenshot audit (all 4 viewports, prod build) where each section survives the question "would
this hold up on Attio/Linear/Sandcastles?" — plus the standing gates: tsc, build, full vitest,
zero overflow, zero console errors. Then commit → PR → merge (repo: PRs merge with merge
commits; post-commit hook auto-pushes).

## Kickoff prompt for the next session

> Read docs/HANDOFF-2026-08-10-trial-landing-refinement.md and follow it: visually audit the
> whole /trial page section by section with the committed harness, compare against Attio,
> Linear and Sandcastles AI, then rework the page UI to production quality. Placeholders for
> copy/video/images stay; everything else is in scope.
