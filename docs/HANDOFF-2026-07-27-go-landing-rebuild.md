# Handoff — /go landing rebuild in the Linear idiom (2026-07-27, session 12)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Tip at write time:** `f68ee5db`
**Nothing has been built yet.** This session was measurement + design direction. The tree is clean;
no source file was touched. Everything below is a plan grounded in numbers taken off the live pages.

> Session 11's handoff (`HANDOFF-2026-07-27-go-offer-rebuild.md`) still governs the page as it
> ships today, and its **§4 rejected-concept trail is still binding**. Read it first.

---

## 0. The brief, in the owner's words

- *"Not happy with this hero shot, let's rethink the UI design."*
- *"I want users to be absolutely certain that this is a Wow product, a cheat code."*
- *"Something that a billion dollar company would release."*
- *"Let's rethink our landing page design completely, and adopt the design concept of Attio, Cursor and Linear."*
- *"Don't cut — I have the testimonials, proof, logos etc all ready."*
- *"Attio has so much animation in the actual panels which looks really premium. Ours just looks like AI trash."*

The last one is the crux and it is **correct**. See §2.

---

## 1. What was measured (this is the evidence base — do not re-derive it)

All captured in one headless Chromium at `1440×900 @2×` on 2026-07-27, probing computed styles
off the live sites.

### 1a. Geometry

| Metric | Linear | Attio | Cursor | Maven today |
|---|---|---|---|---|
| Background | `rgb(8,9,10)` | `#fff` | `rgb(247,247,244)` | `rgb(20,20,19)` |
| Theme | dark | **light** | **light** | dark |
| Hero size / weight | 64px / 510 | 64px / 600 | — / 400 | 70px / 500 |
| Hero tracking | −0.022em | −0.020em | −0.0125em | −0.028em |
| Hero leading | 1.00 | 0.95 | 1.25 | 1.03 |
| Hero alignment | **left** | centre | centre | centre |
| Content max-width | 1436 | 1440 | 1300 | **1180** |
| Hero shot width | **~91% vw** | ~78% vw | — | **~69% vw** |
| Section padding-top | 128px | 152px | 67px | 115px |
| CTAs in fold | **0** (nav only) | 2 | 1 | 1 |

🔑 **Two of the three references are LIGHT.** Only Linear is dark. They are not one aesthetic.
**Linear is the visual reference; Attio and Cursor are grammar references** (logo wall, metrics
band, case-study-with-a-number, announcement pill). Take structure from them, never colour.

### 1b. Motion — the decisive measurement

| Metric | Linear | Attio | Maven today |
|---|---|---|---|
| CSS animations in fold | 180 | 18 | **9** |
| **Infinite / looping** | **180** | 11 | **1** |
| WAAPI animations running | 103 | 14 | **1** |
| SVG elements | 180 | 447 | 27 |
| `<video>` elements | **0** | **0** | 0 |

- Maven's counts **do not change as you scroll** — 1 infinite animation on every part of the page,
  and it is `ping`, a Tailwind default. The entire page has one continuously-moving element.
- Linear's infinite animations are named `grid-dot-0-0-upDown` (2.8s), `shine` (2.2s), `scroll` (30s).
- Attio's are `pipeline-radar-ring-outer` / `-inner` (3.6s) and `pipeline-radar-bob` at **3.8s AND
  4.15s** — deliberately different periods so the loops never phase-lock into a synchronised pulse.
- 🔑 **Neither uses video.** All of it is CSS + SVG + Web Animations, fully reproducible with our stack.

---

## 2. The diagnosis

**Their motion is infinite and lives inside the product. Ours is one-shot and lives on the containers.**

`BlurFade` / `Reveal` fire once on scroll and then freeze forever. The hero probe sequence runs once,
completes at 5900ms, and the fold is dead for the remainder of the visit. Fade-up-on-scroll-then-freeze
is the signature of every generated landing page — that is precisely what reads as "AI trash".

Secondary, from §1a: the product shot is too small (69% vs 91%), the floor is too light
(`rgb(20,20,19)` vs `rgb(8,9,10)` — against near-black a screenshot looks lit from within), there is
too little air above the headline (~150px vs Linear's ~370px), and tracking is over-tightened.

⚠️ One claim in the owner's research brief was **wrong** and should not be carried forward: that the
current two-tile receipt fold "is already the Linear/Attio pattern executed correctly." It is not —
that fold contains **zero pixels of Maven**. Linear's pattern is the product UI as hero; Attio/Cursor
is a live agent doing real work. Two photographs of a stranger at a microphone is the opposite.

---

## 3. The plan

Build on a **no-auth review route**, following the `/ambient-v2` precedent already in this repo.
Do **not** modify `/go` until the owner has seen and approved the route.

### Phase 1 — the route + geometry
- New route `src/app/(offer)/go-v2/page.tsx`, no auth, not linked from anywhere.
- Apply the geometry spec (§4). Content column 1180 → 1400. Hero shot to ~90% viewport width,
  **no border and no browser chrome** — Linear shows neither.
- Marketing floor token `#0d0d0c`. **The app's own `#1f1f1e` does not change** — this is a
  marketing-surface-only token.
- Verify on a prod build at 1512×860 and 390×844. Re-measure the CTA position after every addition.

### Phase 2 — the motion system (the actual point)
See §5 for the full spec. Target: **≥40 infinite animations** on the page, from 1 today.
Do not chase Linear's 180 — most of that is a decorative dot grid we do not want.

### Phase 3 — page architecture
Section order per §6. Nothing is cut. Placeholders per §7.

### Phase 4 — verification
- Full suite BOTH flag ways, `tsc`, lint, prod build.
- Re-run `.scratch/motion-probe.js` against `/go-v2` and confirm the infinite-animation count.
- Screenshot comparison against `bm-linear-fold.png` / `bm-attio-fold.png` at identical viewport.

### Phase 5 — cutover
Owner review on the prod build → then port to `/go`, or flip a flag. Never a big-bang replace.

---

## 4. Geometry spec — exact values

```
FLOOR (marketing only)   #0d0d0c        ← new. app bg #1f1f1e is UNCHANGED
surface ladder           s1 #141413 · s2 #1a1a19 · s3 #1f1f1e · s4 #232322
content max-width        1400           (was 1180)
hero shot width          ~90% viewport, no border, no chrome
air above h1             ~300–370px     (Linear ≈370; today ≈150)
section padding-block    128–152px      (today 115)
h1                       64–70px · weight 500 · tracking −0.022em · leading 1.02
body                     Inter 400 · 16px / 1.55
accent                   #FF6363 — brand mark, focus rings, ONE primary CTA per section
```

🔑 **Accent dosage:** the current fold runs FIVE accent moments (page bloom, receipt bloom, ↑792×
badge, italic *before*, coral CTA) against a LOCKED near-zero rule. Linear deploys its one chromatic
colour on the brand mark, focus rings and one CTA per section. Match that discipline.

Alignment: Linear is left-aligned, Attio centred. **Stay centred** — it suits a single-CTA fold and
it is what the current page already does. Do not spend a decision here.

---

## 5. Motion system spec

**Rule: motion belongs inside the product surface, not on its container.**

### 5a. Ambient loops — every product surface gets at least one
| Surface | Loop | Notes |
|---|---|---|
| Audience constellation | dot drift + opacity breathe | already a particle field; cheapest win |
| Attention curve | scrubbing playhead along the path | the curve already renders |
| Cortex (`cortex.glb`) | slow Y rotation | 3D model already loaded — nearly free |
| Filmstrip weak-beat markers | pulse, **desynced per marker** | the amber `⚠ WEAK BEAT` chips |
| Craft ring | slow sweep | |
| Receipt counter | `NumberTicker` re-run on a long interval | |
| Composer in the shot | caret blink / typing loop | |

### 5b. Non-negotiable craft rules
1. **Desynchronise every duration.** Attio uses 3.8s *and* 4.15s for the same animation. Never let two
   loops share a period — a page pulsing in unison reads cheap. Use spread values (3.7 / 4.3 / 5.1 / 6.7s).
2. **Loop the hero sequence.** It currently runs once and dies at 5900ms. It must restart, with a
   long pause, so the fold is alive at 30 seconds as well as at 3.
3. **Name animations semantically**, as Attio does (`pipeline-radar-bob`). Not `fade-1`.
4. **Retire container-level `BlurFade`/`Reveal`** anywhere a surface can move instead.
5. **Respect `prefers-reduced-motion`** — all ambient loops must stop. Non-negotiable, and it will
   also be how the test suite pins them.
6. Motion must not fight the matte rule — no glow, no glass. Movement, not shine.

### 5c. Acceptance test
`node .scratch/motion-probe.js` (already written) against `/go-v2`:
- infinite animations **≥40** (today: 1)
- count must **not drop to 1** after scrolling past the fold
- with `prefers-reduced-motion: reduce`, count returns to ~0

---

## 6. Page architecture — nothing cut

```
nav (3 links + 1 CTA — already correct)
hero            — product running, bled, cropped at the fold edge
logo wall       — PLACEHOLDER slots (owner has real assets)
three-up        — read / room / cut, three statements
1.0 The read    — the Test card + filmstrip
2.0 The room    — the audience tab
3.0 The brain   — cortex + transcript + attention curve
metrics band    — 500 / 10 / ~90s  (ONLY these; see §8)
case study      — 231 → 183,000, number as the headline (Attio pattern)
testimonials    — PLACEHOLDER slots (owner has real assets)
pricing         — visible, Free column first
guarantee + FAQ — keep
final CTA       — same single CTA repeated
footer
```

Rationale for the two moves that matter:
- **The probe becomes the fold.** Proof below the fold is proof wasted, and it had to be
  intersection-armed precisely because nobody was seeing it.
- **The receipt moves down to a case study.** An anonymous, unverifiable number cannot carry a cold
  fold. After the machine has been seen working, the same number corroborates instead of asserting.

---

## 7. Placeholder policy (owner instruction — placeholders are approved)

Anything not yet available ships as an **obvious** placeholder: logos, testimonials, the case-study
quote, product screenshots and any video.

**Rules:**
1. Placeholders must be **visually unmistakable** — dashed 1px border, muted label (`LOGO 1`,
   `TESTIMONIAL — name · handle · quote`). Never a plausible-looking fake.
2. **Never fabricate a name, company, handle, avatar, quote, rating or metric.** A dashed box is
   honest; an invented testimonial is not, and this page's entire argument is credibility.
3. Placeholder copy lives in one module (suggest `src/components/offer/placeholders.ts`) so the
   swap is one file.
4. **Add a guard test** that fails if any placeholder marker string is reachable from the production
   `/go` route. `/go-v2` is exempt while it is a review route. This is the thing that stops a
   dashed box shipping to paid traffic.
5. Real assets to request from the owner when building: 6 logos, 3 testimonials (name, handle,
   avatar, quote), the case-study quote. Ideally one testimonial names a **specific second or a
   specific fix** — concrete beats enthusiastic.

---

## 8. Honesty constraints — carried forward, all still binding

- **Only these metrics exist**: `500` viral videos dissected · `10` named viewers · `~90s` to a
  verdict (`proof-mechanism.tsx`). Plus the cited receipt `14.2×` / `2.4M`. **Invent nothing else.**
- **No viewer count in the headline.** "up to 1,000" was reconciled out of the hero on 2026-07-26 and
  survives only in metadata. `PlatformBar` carries no viewer count either.
- The `read` block in `featured-video.ts` is a **fixture**, labelled "Sample read" in the window
  chrome. Keep the label.
- Current footage is placeholder **Acquisition.com material with identifiable people**; rights
  unresolved, owner is replacing it. All clip assets route through `featured-video.ts` + the six
  files in `public/offer/featured/`, so the rebuild and the swap are independent.
- The receipt band only fully pays off **attributed**. Unattributed it is the same unverifiable
  claim, just better positioned.

---

## 9. ⛔ Do not re-propose

Carried from session 11 §4 — five "show" concepts already rejected, every one an **abstraction of
the product instead of the product**:
1. Side-by-side always-on panel (rejected ×2) · 2. Static figure strip · 3. Wireframe mini-demo ·
4. `HeroDemo` 9s loop · 5. Bespoke "Verdict Reel"

Added this session:
6. **Cutting Testimonials / ProofMechanism / Transformation** — explicitly refused; the owner has
   the assets.
7. **Founding-price cohort** — permanently rejected (carried).
8. **Linear's zero-CTA fold** — they can afford no button in the fold; cold social traffic at a 1.5%
   baseline cannot. One high-contrast CTA above the fold stays.
9. **Attio's two-CTA fold** — a second button only splits the click on a 90-second self-serve product.
10. **Inter-only display type** — Newsreader is the voice and the one deliberate divergence from
    Linear. It is what stops this being a clone.

---

## 10. Landmines

- **`npm test` is FAKE.** Use `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways
  (`NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true`).
- **`npx eslint` dies intermittently** — `node node_modules/eslint/bin/eslint.js`.
- **Never judge this funnel on `next dev`** — StrictMode makes the /go → /home arrival look stone
  dead. Prod build only:
  ```
  pkill -f "next dev -p 3000"; npm run build
  nohup env NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true npx next start -p 3000 > .scratch/prod-3000.log 2>&1 &
  ```
- **THREE worktrees serve /go — this one is :3000.**
- Playwright scripts go in `.scratch/` and `require('@playwright/test')`. `tsx` cannot run Playwright.
- **The cortex is WebGL (`public/brain/cortex.glb`) and does NOT render headless** — `no-canvas`,
  even with swiftshader flags. It renders fine in a real browser. Any headless screenshot of the
  brain tab will show an empty box. This is not a bug; do not "fix" it.
- **Capture filenames from this session are unreliable.** The read rail cycles tabs every 5s, so
  `rail-brain.png` actually contains the *audience* tab. Corrected copies are `brain-tab.png` and
  `audience-tab.png`. **Always verify which tab is active before trusting a capture.**
- `NumberTicker` reads **mid-spring** in screenshots (`181,071` not `183,000`). Not a bug.
- `AmbientDetail` takes an optional controlled `tab` prop; it is shared with `/ambient-v2`,
  `pricing-template`, `detail-live-fixture` and `shot-stages`. **Never mutate `CREATOR_TEMPLATE`.**
- ⛔ `supabase db push` is UNSAFE here — 48 local-only / 41 remote-only migrations.
- `shot-stages.tsx` how-it-works webps still capture the **LEGACY** room — stale vs v2.

---

## 11. Artifacts on disk

⚠️ `.scratch/` is **gitignored** — these survive in this worktree for the next session but are not
committed. Regenerate with the scripts if lost.

| Path | What |
|---|---|
| `.scratch/compare.html` | Measured comparison: Maven vs Linear vs Attio, 3 folds + tables |
| `.scratch/landing-concept.html` | Full-page concept in the Linear idiom |
| `.scratch/hero-concepts.html` | The four hero concepts (A verdict-lands · B filmstrip · C video-in-room-out · D bento) |
| `.scratch/benchmark.js` | Captures + probes geometry on linear/attio/cursor/ours |
| `.scratch/motion-probe.js` | **The acceptance test for §5c** — counts infinite animations |
| `.scratch/capture-surfaces.js` | Captures real product surfaces off the prod build |
| `.scratch/surfaces/bm-*-fold.png` | Real Linear / Attio / Cursor folds @1440×900 |
| `.scratch/surfaces/{filmstrip,card,audience-tab,brain-tab,receipt,gl-window-full}.png` | Real Maven surfaces |

---

## 12. Open — owner decisions still owed

1. **Real assets**: 6 logos, 3 testimonials, the case-study quote.
2. **The card cliff.** Free-trial-no-card converts at 7.2% median vs 3.1% with a card — roughly a
   halving, and larger than every layout change in this document combined. Where the card wall lands
   is a money-path decision, not a design one. Tangled with the open `/pricing` defect that offers
   $1 to an account that already used its trial.
3. **Traffic segmentation before judging.** Social baseline 1.5% vs paid search 3.2% on an identical
   page. If /go is judged on a blended number the rebuild is unmeasurable.
4. **Something true to announce** for the freshness pill (Attio runs an announcement bar *and* a
   badge; Linear runs "New · Coding Sessions →").
5. Dead code still awaiting a call: `hero-entry.tsx`, `frame-stills.ts`, `PrimaryCta`,
   `hero-demo.tsx`, `sections/sticky-cta.tsx`, `product-render.tsx` (carries the repo's one lint error).
6. Pre-existing money-path items: chat-dispatched runs unmetered for real customers;
   `/api/account-read` ungated and absent from `CREDIT_COSTS`.
