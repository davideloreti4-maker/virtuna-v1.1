# HANDOFF — `/go` below-hero rebuild, and the conversion pass that's still open (2026-07-26)

**Merged to `main` as `375366f0` (PR #383).** Cherry-picked onto current main; `lane/maven-offer`
was 122 commits behind but the offer files had not diverged, so it applied clean.
**Worktree:** `~/virtuna-maven-offer` · **Branch:** `lane/maven-offer` (tip `66edd445`, same content)
· **Dev:** `:3020` · **Route:** `/go`

> **Scope boundary that still applies:** the HERO is owned by a parallel session. This session
> touched nothing above `<PlatformBar/>`. Keep that split — see §5 for the hero-owned items that
> need the owner.

---

## 1. What shipped

### Real product screenshots (the reusable machinery)

`/dev-shots` is a **dev-only** route that mounts the SHIPPED surfaces at exact framing:
`EmbeddedComposer`, `AmbientRoom`, `VideoTestCardRenderer` — fed the same fixtures the hero uses.
`scripts/capture-offer-shots.ts` photographs each `[data-shot]` element into
`public/images/offer/*.webp` at deviceScaleFactor 2.

```bash
cd ~/virtuna-maven-offer
node --max-old-space-size=2048 ./node_modules/next/dist/bin/next dev -p 3020
npx tsx scripts/capture-offer-shots.ts            # all stages
npx tsx scripts/capture-offer-shots.ts --only=step-react --keep-png
```

**Re-run it after any redesign of the composer, the room, or the test card.** The shots are a
snapshot; this is the one command that refreshes them. Verified 404 in production against a real
`next build` + `next start`.

Four things that each cost a debugging round — don't rediscover them:

| Trap | What happens | Fix |
|---|---|---|
| `_shots` as a folder name | App Router treats `_`-prefixed folders as **private**; route 404s | named `dev-shots` |
| `SHOTS` exported from a `"use client"` module | RSC gets a client-reference stub → `shot` is `undefined` → every shot crashes on `.src` | `product-shot.tsx` is deliberately **not** a client module; it only *composes* one |
| headless Chromium | refuses a WebGL context → the room's three.js brain photographs as an empty box | `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` |
| Next dev overlay | bakes a red "N Issues" badge into element screenshots | hide `nextjs-portal` before the shutter |

### The sizing rule that drove the layout

**A capture's width must track its DISPLAY width.** A 900px surface downscaled into a 320px column
renders app UI at ~7px, which destroys the entire "these are real product pixels" argument. Two
consequences:

- **How-it-works was regridded** from 3 columns to **alternating rows** (~600px media).
  Per-row grid templates, because a single `[1fr_620px]` template put a flipped row's shot in the
  *flexible* column and shrank it to ~345px.
- **Mobile gets separately captured 390px variants**, served via `<picture>` media query — this is
  art direction, not a resize, and the browser downloads exactly one file.
  Sanity check: `naturalWidth / (displayWidth × 2)` should land ≈ 1.0–1.3.

Placeholders replaced: Transformation's two unbuildable 9:16 slots → **one** real artifact (the
director's fixes + the `14.2×` corpus receipt); How-it-works' three slots → composer / the room's
named viewers / the verdict card.

### Motion

`src/components/offer/motion/reveal.tsx` — four gestures (`rise`/`wipe`/`settle`/`lift`),
`Stagger`+`StaggerItem`, scroll-linked `Parallax`, one shared easing (`OFFER_EASE`). Replaces
"BlurFade at one stagger everywhere" below the hero.

- `CountUp` renders the real figure **server-side**, then hands to `NumberTicker` on hydration —
  `NumberTicker` alone SSRs its `startValue`, so "~90s" was shipping as "~0s".
- **`<noscript>` net in `(offer)/layout.tsx`.** 23 reveals are `opacity:0` in the server HTML; without
  it a JS failure serves paid traffic a blank page. The same exposure exists anywhere `BlurFade` is used.

### Conversion structure

- **Pricing moved 6,517px → 5,103px.** Order is now stakes → mechanism → authority → **ask** →
  risk-reversal → demo → cohort → FAQ → close. The empty demo band and empty testimonial grid no
  longer sit between a convinced visitor and the ask, and a CTA closes How-it-works.
- **`tone="surface"` and `tone="sunken"` were BOTH `#1a1a19`** — the offer page's "alternating
  tone-zones" had silently been ONE band since they were built. Renamed: `sunken` steps down,
  `lifted` (`#242423`) steps up, pricing is the brightest ground. *Measure the computed color;
  never trust two token names to differ.*
- Sticky CTA now works on **desktop** too (was `lg:hidden`), standing down over `#pricing` /
  `#final-cta` so it never competes with the button it points at.

### Copy corrections

- **"your video never leaves TikTok, and we never upload or store it"** was false in three places
  (PlatformBar + Guarantee + FAQ). `/api/analyze` re-hosts a `tiktok_url` via `resolveAndRehost`
  and stores a `video_upload` in Supabase storage — reading frames *requires* the file. Rewritten.
  **Keep this accurate**: a false privacy claim on a paid page is chargeback material, which is a
  conversion cost, not a moral one.
- **"1,000 viewers" removed below the hero** — that's Pro-only population depth; every plan gets a
  room of 10 named viewers. A new FAQ explains both scales.
- `MediaSlot`'s `1920×1080 · .MP4` spec hint is **dev-only** now; it was rendering to visitors.

---

## 2. ⚠️ Owner direction that changes the next session's brief

The owner's closing note: **"don't focus on the honesty — we want a high conversion rate."**

The assistant had over-indexed on defensive/limiting copy. The next session should strip that
framing **while keeping factual claims accurate** (the privacy wording above is the one carve-out,
for chargeback reasons, not moral ones).

---

## 3. ▶ NEXT — the agreed conversion pass (ranked, none of it started)

| # | Fix | Why |
|---|---|---|
| 1 | **Delete "And what it doesn't claim"** — the 3-limit card in `proof-mechanism.tsx` | A full card of anti-copy at the authority beat. Replace with the corpus proof (`14.2×`, `2.4M`) — same credibility, forward-facing |
| 2 | **Testimonials → a benefit block** (`testimonials.tsx`) | "These seats are open" still announces "no customers" mid-arc |
| 3 | **Demo band copy** (`demo-video.tsx`) | "we're recording it… lands here when it's honest" apologizes for a missing asset — make it neutral, or cut the section |
| 4 | **FAQ tone** (`faq.tsx`) | "What if the prediction is wrong?" leads with doubt; the privacy answer is a defensive paragraph. Both → short and confident |
| 5 | **Add a CTA after Transformation** | First ask is ~3,900px in; add one at ~2,200px |
| 6 | **PlatformBar → benefit-led** (`platform-bar.tsx`) | Chips state mechanism ("reads frame by frame"), not outcome |

All six are copy/structure only — no new captures, no new assets.

---

## 4. 🔴 Two owner decisions — the biggest remaining levers

1. **Real scarcity.** A founding cohort with a price actually locked (e.g. first 100 keep $49
   forever) is the strongest untapped lever and it *fills the testimonial hole with a reason to act
   now*. Do NOT invent a countdown — build it only if the owner will honor it.
2. **Coral CTA A/B.** `CTA_VARIANT` in `src/components/offer/cta-config.tsx` is a **one-line flip**
   (`"cream"` → `"coral"`), already wired through every primary CTA. Cream is dosage-compliant;
   coral will likely convert better. Owner has not decided.

---

## 5. Hero-owned, needs the owner (do NOT edit from the below-hero lane)

"1,000 viewers" is still claimed in hero-owned copy, and it's Pro-only:
- `src/app/(offer)/go/page.tsx` — the `metadata.description` and the hero subhead
- `src/components/offer/ambient-panel.tsx:47` — the room header chip

---

## 6. Verification state at merge

`tsc` 0 · eslint 0 in scope · matte guard 38/38 · prod build green · `/dev-shots` 404s in
production · `/go` 200 with **0 console errors** and **0 horizontal overflow** on desktop *and*
mobile · reduced-motion **23/23** reveal · art direction confirmed (desktop serves full-size,
mobile serves `-sm`, pixel ratios 1.04–1.27) · suite **4358 passed**.

**One pre-existing failure:** `src/components/app/home/__tests__/composer.test.tsx` ("The Read" not
found). Verified failing at **clean HEAD** via `git stash` — not from this work. The one remaining
lint error is in the hero's `product-render.tsx` (`setState` in effect), also untouched.

## 7. Gotchas worth keeping

- **Verifying scroll reveals**: jump-scrolling to the bottom skips IntersectionObserver frames and
  reports everything as hidden — a testing artifact, not a bug. Scroll each element into view
  individually, and allow ~1.5s for the animation before judging opacity.
- **Screenshots of `/go`**: freeze animations first (`animation-duration:0`), and force
  `[data-slot="offer-reveal"]` to `opacity:1` — otherwise below-fold sections photograph blank.
- Dev server: direct-node, not npx; `rm -rf .next` after a branch switch.
