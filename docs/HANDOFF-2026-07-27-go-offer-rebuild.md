# Handoff — the /go offer page, rebuilt around one real video (2026-07-27, session 11)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` (pushed)
**MERGED TO MAIN** — PR #387, merge commit `56ee4e66`. `main` is what Vercel deploys, so this is
in production.
**Green on the merged tree:** suite **434 files / 4,746 (flags off) · 4,747 (flags on) / 0 fail
both ways** · `tsc` 0 · `npm run build` OK · lint clean apart from the pre-existing, unreferenced
`product-render.tsx`.

> Session 10's handoff (`HANDOFF-2026-07-27-demo-entitlement.md`) is still accurate for the
> billing/funnel half. This one covers the offer page. §0 of session 9's handoff still governs
> everything: **never judge the /go → /home arrival on `next dev`** — StrictMode makes it look
> stone dead and it does not ship that way.

---

## 0. What this session was

A design conversation that turned into a rebuild. The owner opened with *"the current offer page
isn't what a billion dollar company would release"* and led the whole way. The shape landed after
several rounds and **five previously rejected concepts** (see §4 — read it before touching the
hero).

The page now tells ONE story: *here is a real video, here is what Maven said about it, here is
what happened when the creator acted on that read.*

---

## 1. The page as it stands

**Fold** — headline `Know if your video will pop — before you post it.` (reverted to the original
wording after the numbers-as-headline version was tried and rejected), original subhead, then:

- **`OutcomeReceipt`** — two tiles of the SAME clip: left drained/grayscale/small at `▶ 231`,
  right full-colour, larger, lit, count climbing to `183,000` on the tile, `↑792×` on the
  connector between them. Counts sit ON the tiles, where a video surface puts them.
- **One CTA** — `Test a video free` + microcopy. The sticky bar is unmounted.

**Below the fold** — `HeroShowcase` → `HeroProductWindow`: a **non-interactive probe** (`inert`
stays) at full platform fidelity. Sequence: types into the docked composer → sends → the turn
rises into the thread → Maven thinks → streamed reply → reading ring → the real Test card
assembles → the read rail materialises → the two read pages cycle.

Then the untouched persuasion arc: `PlatformBar → Transformation → HowItWorks → ProofMechanism →
Pricing → Guarantee → Testimonials → Faq → FinalCta → Footer`.

---

## 2. The files that matter

| File | What it owns |
|---|---|
| `src/components/offer/featured-video.ts` | **THE SWAP POINT.** The clip's identity: cover, five beat frames, runtime, drop label, the 231 → 183,000 receipt, the card read, and the room read. |
| `public/offer/featured/` | `cover.jpg` + `beat-1..5.jpg`, extracted from the source mp4. |
| `src/components/offer/featured-room-template.ts` | Retargets the shared v2 `CREATOR_TEMPLATE` at this clip WITHOUT mutating it. |
| `src/components/offer/test-card-fixture.ts` | Composes the `video-test-card` block from `FEATURED_VIDEO`. |
| `src/components/offer/outcome-receipt.tsx` | The fold's two-tile receipt. |
| `src/components/offer/hero-product-window.tsx` | The probe + its choreography. |
| `src/components/offer/free-entry-cta.tsx` | `FreeEntryCta` + `useFreeEntry` — the page's one action. |
| `src/components/offer/__tests__/featured-video.test.ts` | 8 guards on the swap (see §5). |

### Swapping the clip (the owner is replacing this footage in days)

1. Replace the six files under `public/offer/featured/`.
2. Edit `featured-video.ts` — numbers, beats, labels, the read.
3. Run the guard test. It fails if a frame is missing, the drop label lands on a beat you didn't
   mark weak, beats fall outside the runtime, the block stops parsing, or the room read still
   mentions the retired video.

⚠️ The current footage is an **Acquisition.com event clip with identifiable people**. It is
placeholder. The rights question was raised and the owner's answer was that it is being replaced.

---

## 3. Decisions the owner made, in their words

1. **Non-interactive.** *"Make the demo not interactive, and the composer not real — a probe to
   give the user a feeling of the platform."* `inert` stays; the composer inside is part of the
   shot.
2. **The composer leaves the fold.** Either into the shot or out entirely — it went into the shot,
   and the real entry became a button.
3. **The receipt is concrete.** *"Show the thumbnail and the views how they evolve"*, then
   *"showcase the thumbnail at 200 vs the thumbnail at 180k… premium ui design and animation."*
4. **Real numbers, anonymous.** 231 → 183,000, same video recut and reposted, no creator handle.
5. **Fixture over a real run** — the clip is being replaced anyway.
6. **Headline reverted** to the original wording.
7. **The read's two pages cycle**, opening on the brain, alternating indefinitely.

---

## 4. ⛔ DO NOT RE-PROPOSE — the rejected-concept trail

Five "show" layers have now been rejected. From session 7's handoff §3 plus this session:

1. Side-by-side always-on panel (rejected ×2)
2. Static figure strip
3. Wireframe-grade mini-demo
4. `HeroDemo` — the abstracted 9s loop
5. **A bespoke "Verdict Reel"** — a phone frame playing the clip with an invented reaction UI
   beside it. Rejected on sight: *"way too off compared to what's really on the platform."*

**The shared diagnosis every time: an ABSTRACTION of the product instead of the product.** The
thing that finally worked is the shipped components on shipped fixtures. If you are about to draw
a new UI for the hero, you are probably about to make miss number six.

Also standing: the founding-price cohort is **rejected** — never re-propose it.

---

## 5. What measuring caught that reading would not have

Each of these looked fine in code and was wrong on screen. This is the argument for verifying on a
prod build rather than reasoning about it.

- **The demo was never being seen.** It started on mount and finished at 5900ms while sitting below
  the fold, so it performed to an empty viewport on every real visit and every visitor met a
  finished, static shot. That is why the page read as having no demo at all. Now armed on
  intersection — verified: 2.5s after load with the window below the fold, nothing has run.
- **The reading beat rendered as ~500px of nothing.** The overlay was `inset-0` + `justify-center`
  on the CARD container, which is ~1400px tall at phone width, so the ring centred far below the
  window. Latent on both breakpoints.
- **The CTA fell below the fold** after the two-tile receipt landed — measured off-screen on a
  1512×860 MacBook and a 390×844 phone. The page's one ask, invisible on the two most common
  viewports.
- **The tab switch flashed** because it was driven by remounting with a `key`, which tore down the
  whole rail. Fixed with a controlled prop; verified the DOM node survives the switch.
- **Mobile: a part-height sheet clipped the read** at its own heading, losing the payoff sentence.
  Reverted to the near-full drill. At any phone height you cannot show the full card AND the full
  audience read; the real app does not try either.

### The fixture drift, which was the big one

The Test card described an **imaginary video** and contradicted itself: `dropLabel: "0:06 drop"`
beside a fix reading *"you lose them at 0:08"*, a `0:15` runtime on a 53s clip, `audienceName:
"Skincare buyers"`, a diagnosis quoting a **freelancing** hook.

Worse, the room fixture narrated a different video *throughout* — and nobody had ever seen it,
because nothing rendered the brain page until this session made the probe visit it. Making it
visible exposed: a "$400 stake", a drop at 0:04, a 12-second clip, `builders` clusters, the
nine-signal prose, `audienceFit`, the carriers, a swing moving 38%→49%, and a room claiming to be
calibrated on *"your 4.2k followers"* — which a cold anonymous visitor has no account to have.

🔑 **The lesson: inheritance carries PROSE.** `FEATURED_ROOM_TEMPLATE` spreads `CREATOR_TEMPLATE`
so the deep instrument data stays real, but every human-readable string had to be retargeted. Two
guards now pin it — no string in the room template may name the retired video, and every coded
reason's `thread.toMoment` must equal a brain moment that exists (it is matched by **string** to
jump tabs and flash the beat, so a stale value doesn't throw, it just silently stops working).

Also removed: invented corpus receipts (multipliers + view counts) attached to **named
third-party TikTok accounts**. The schema's warrant contract explicitly allows honest absence.

---

## 6. Landmines for the next session

- **`npm test` is FAKE.** Use `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways
  (`NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true`).
- **`npx eslint` dies intermittently** — `node node_modules/eslint/bin/eslint.js`.
- **Never judge this funnel on `next dev`.** Prod build only:
  `pkill -f "next dev -p 3000"; npm run build; nohup env NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true npx next start -p 3000 > .scratch/prod-3000.log 2>&1 &`
- **THREE worktrees serve /go — this one is :3000.**
- `NumberTicker` reads **mid-spring** in screenshots; the receipt will show e.g. `182,377` rather
  than `183,000`. Not a bug.
- Playwright scripts go in `.scratch/` and import from `@playwright/test`. `tsx` cannot run
  Playwright (`__name`).
- **`AmbientDetail` now takes an optional controlled `tab` prop.** Omit it and every in-app mount
  behaves exactly as before. It is shared with `/ambient-v2`, `pricing-template`,
  `detail-live-fixture` and `shot-stages` — do not mutate `CREATOR_TEMPLATE` in place.
- ⛔ `supabase db push` is UNSAFE here — 48 local-only / 41 remote-only migrations.
- One **flaky** flags-on failure was seen once mid-session and did not reproduce across four
  subsequent full runs. It was not identified. If a single unexplained failure appears, re-run
  before chasing it.

---

## 7. Open — carried into the next session

### The hero, which is where the owner wants to work next
The owner's words: *"I want to work some more on the hero as we have a lot of UI design
refinements that we need to work on."* Nothing specific is queued — **open with their direction.**

Two things I would put in front of them:
- The **cover frame is the least dynamic moment in the clip** (the asker at a mic, static). It is
  now shown twice at size in the fold, so it carries more weight than it did. A frame with motion
  or a face mid-expression would sell those tiles far harder.
- The fold is **spatially tight**: two ~300px tiles plus a CTA. Any addition needs re-measuring at
  1512×860 and 390×844, or the ask goes below the fold again.

### Dead code, owner call needed (never deleted unasked)
`hero-entry.tsx`, `frame-stills.ts`, `PrimaryCta` (in `cta-config.tsx`), `hero-demo.tsx`, and
`sections/sticky-cta.tsx` are all now unreferenced. `product-render.tsx` was already dead and
carries the repo's one lint error.

### 🔴 Money-path decisions still owed (pre-existing, NOT introduced here)
1. **Chat-dispatched skill runs are neither gated nor billed for real customers.** The only leash
   in `chat-agent-loop.ts` is a per-turn run count, not the meter. Needs a policy + plumbing.
2. **`/api/account-read` has no gate and no bill**, is not in `CREDIT_COSTS`, and is the one Start
   tile that fires on tap (1–3 min Apify scrape). A pricing decision.

### Smaller, carried
- A refused send loses the visitor's typed topic · email-claim return marker · `/home/loading.tsx`
  blink · `shot-stages.tsx` how-it-works webps still capture the LEGACY room (stale vs v2).
- NOT proven live: that a delivered run forecloses the second free Test (needs a real billed run).
