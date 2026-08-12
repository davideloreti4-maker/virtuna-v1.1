# Handoff — the hero window + the flow's connective tissue (2026-07-27, session 8)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` (pushed — §1b adds
two commits on top of `43444fec`)
**Green:** suite 424 files / 0 fail BOTH flag ways after every commit · `tsc` 0 · lint clean
(3 pre-existing composer warnings + 1 pre-existing error in unmounted `product-render.tsx`)

> Reads on top of `HANDOFF-2026-07-27-hero-iterations.md` (session 7 — the feedback trail
> there still governs the hero) and `HANDOFF-2026-07-26-checkout-and-claim.md` (session 6).
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired walkthrough.

---

## 1. What changed, in one line

The hero got its fourth "show" candidate — the REAL platform surface at full fidelity in one
large app window (session 7's diagnosis, executed) — and three of the five flow gaps closed:
the post-claim return now opens the verdict, every below-fold CTA funnels into the free test,
and how-it-works photographs the current v2 room.

## 2. The 4 commits

### `9a368321` — HeroProductWindow (🔴 owner review pending — the hero's 4th candidate)

`src/components/offer/hero-product-window.tsx`, mounted by `HeroShowcase` under the
composer (which is untouched: centered, max-w 640, Free badge). The window:

- **max-w 1024, browser chrome, one large app-shot** — the premium pattern (the big
  product frame under the entry), NOT the rejected side-by-side fold layout.
- **Renders the SHIPPED components on the SHIPPED fixtures**: thread pane = real
  `VideoTestCardRenderer` on `TEST_CARD_FIXTURE`; right pane = real `AmbientDetail`
  (`presentation="rail"`, the exact ≥xl /home mount) on `CREATOR_TEMPLATE`, opened on the
  **audience tab** (the card already shows craft; reception is what the visitor can't guess).
- **ProductRender's proven choreography + one new beat**: typing → thinking → reply →
  reading ring → card assembles → **the read rail materialises** → one BorderBeam pass.
  Plays ONCE on real scroll (`-30%` margin — `-15%` fired while the headline was being
  read). Focus in the composer = one-way jump to the finished shot. Reduced-motion lands
  finished.
- **`inert` body** — the card's live buttons (Save/Simulate) are a shot, not controls;
  sr-only line describes the scene. "Sample read" tag in the chrome carries the honesty.
- Rail pane hidden < lg (mobile shows the thread + card at near-1:1; the sheet link below
  remains the read's path there). HeroDemo (rejected) unmounted, kept on disk.

Verified: 1440 + 390 shots, rail text present, no horizontal scroll, choreography reaches
done. `.scratch/shot-hero.mjs` re-runs the check.

### `0f3f07e2` — the funnel-return inlet (flow gap 1 ✅)

- `claim-account.ts`: the OAuth link round-trip now lands `/home?claimed=1` (`safeNext`
  preserves the query — verified in the callback source).
- `composer.tsx`: a **funnel-return inlet** next to `simulateVideoInRoom` arms on
  `?claimed=1` OR `?checkout=success` (Whop's funnel `redirect_url`, previously unused),
  strips the marker immediately, and once `persistedSimSeals` rehydrate opens the tested
  video's drill. One behavior serves both states: claimed ⇒ the now-unsealed verdict opens
  + an "Account linked" success toast; checkout ⇒ the still-sealed wall opens, whose CTA
  already reads "Finish unlocking — link your account". No video seal ⇒ the arm expires
  silently.
- `render-with-client.tsx` gained `ToastProvider` (mirrors the (app) layout) because the
  composer now calls `useToast()` — every Composer-mounting test rides that helper
  (audited: none mount it bare).
- Tests: `composer-funnel-return.test.tsx` (4 cases — the seal fixture must be the SEALED
  wire form `{sealed, at, video:{analysisId, craftScore}}`; a bare `{video:{}}` takes the
  unsealed rail path and crashes on missing heatmap) + the claim-redirect test updated.
- ⚠️ NOT covered: the **email claim path** sets no marker — its unseal lands on the email
  CONFIRMATION round-trip, wherever Supabase's confirm link lands. Google (primary) only.

### `1a7868b1` — one entry, every CTA (flow gap 3 ✅)

Nine below-fold CTAs sold "$1" and routed to `/signup` — the bare email round-trip the
funnel replaced. Now:

- **`FREE_ENTRY` SSOT** in `cta-config.tsx`: label "Test a video free", target `#test`
  (anchor on the hero composer, `scroll-mt-28`), microcopy "No account needed — the full
  verdict unlocks for $1 after".
- Flipped to it: sticky bar (both breakpoints), floating-nav menu CTA, footer,
  transformation, how-it-works, testimonials, final close, and the pricing cards
  ("Start with a free test" — the trial is bought at the in-product wall).
- The $1 stays where money is decided, re-sequenced truthfully: pricing sub ("Your first
  Test is free, no account. Every plan then opens with the same $1 trial…"), guarantee
  ("Free to try, $1 to unlock"), FAQ (the "Not a free one" answer is GONE), metadata.
- Live-verified: 8 `#test` CTAs, zero "Start for $1", **zero `/signup` links on /go**,
  final-CTA click lands the anchor at exactly its 112px scroll margin.

### `43444fec` — the v2 shot (flow gap 4 ✅)

`shot-stages.tsx`'s step-react stages mounted the retired legacy `AmbientRoom`. Now:
`AmbientDetail` + `CREATOR_TEMPLATE`, audience tab, sheet presentation in a bounded flex
host (the AmbientPanel pattern — rail presentation would ship a stray left hairline).
Re-captured via `npx tsx scripts/capture-offer-shots.ts --url=http://localhost:3000
--only=step-react,step-react-sm` (works fine under tsx; `cwebp` present). PREPARE's
"The people" click removed. Step-02 copy + alt now describe the new pixels (38.2% would
stop, cohort bars). `room-fixture.ts` unreferenced, left on disk.

## 1b. The premium pass (same day, owner: "high converting and premium … visually verified")

Two more commits, each visually verified at 1440 + 390:

### Fold polish (P1–P4 + P6 of the recommendation)

- **The peek is alive**: the window's choreography starts ON LOAD, not on scroll — the
  ~250px fold peek used to be empty chrome + a cursor; now it's the link typing and Maven
  answering, settling into the card's head + rail tabs. (The -30% scroll-arm traded a dead
  fold for "don't miss the show"; starting on load wins both — the finished shot IS the
  show for a late scroller.)
- **Composed light**: a warm radial bloom anchored behind the window (0.16, blur-110,
  matte-safe), inset top hairline on the chrome, deeper drop shadow.
- **Four fold beats, not seven**: 🔒 emoji line deleted (it duplicated ProofMechanism's
  claim — PlatformBar's stated-once rule), subhead cut to exactly 2 measured lines,
  "Test a video" label dropped (it restated the placeholder), the Free badge centered
  alone — the fold's one axis break is gone.
- The rail's "hook 2 of 5" pager is blanked in the window (`WINDOW_TEMPLATE`,
  `pager: ""`) — app context a cold visitor doesn't have. The captured webps keep it.

### The seam (P5) — measured, then fixed

Frame-burst capture with `/api/analyze` intercepted (held 6s → 402; no engine spend):
pressing the hero's one button froze /go for **~3.2s** (anon sign-in + nav) with only the
13px hint changing; /home's thread engaged at ~4.6s. Fixes:

- **Pre-warm on first focus** (`hero-entry.tsx`): `ensureAnonymousSession` fires when the
  visitor focuses the composer, so the sign-in runs while they paste. Submit → thread
  engaged measured at **~1.4s**. Focus keeps `anonymous.ts`'s no-row-per-page-view intent;
  the submit path re-calls it (idempotent) so a failed pre-warm changes nothing.
- **`busy` prop on `EmbeddedComposer`** (additive): the send disc spins for the residual.
- Arrival verified frame-by-frame: stage list live, rail mounted, no greeting/Start flash.
- **Known blink, deliberately left**: `/home/loading.tsx` draws the EMPTY-home furniture
  (greeting + 6-card grid) for <350ms — wrong for mid-run visitors AND returning
  thread-users alike. Shell-wide follow-up, not a funnel fix.
- ⚠️ The captures minted **3 throwaway anon rows** in prod auth (reaper-eligible, harmless).
- One flags-ON suite run flaked 2 tests under repeated-suite load; 3 consecutive full
  green runs since, both flag ways. Not reproduced, nothing near the changed files.

## 3. Still open, in order

1. **🔴 The hero window needs the owner's eyes.** It is the 4th candidate; §3 of session
   7's handoff still governs. The premium dressing pass (§1b) is IN — if it still misses,
   the next lever is stronger staging (tilt/entrance), not another surface.
2. **First-steps surface** for a fresh anon /home visit (the starter-grid owner question) —
   owner-gated, untouched.
3. **Demo-pool sharp edge** (one 1-credit hook forecloses the free Test, 402) — owner call,
   untouched.
4. Email-claim return marker (see §2 commit 2) — small, do when touching the claim dialog.
5. Reaper scheduling + webhook sandbox pass — owner/reconnect-gated (see
   `vercel-git-disconnected`).

## 4. Landmines (carried + new)

- `npm test` is FAKE — `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways.
- Dev server :3000 (nohup, both v2 flags) — died twice in session 7; restart if refused.
- THREE worktrees serve /go — THIS one is :3000.
- **`npx eslint` intermittently dies with "JSON parse failed" — that's a wrapper, not
  ESLint. Fall back to `node node_modules/eslint/bin/eslint.js <files>`.** `scripts/` is
  lint-ignored by config. No `node_modules/.bin` in this worktree.
- **Playwright in throwaway scripts: import from `@playwright/test`** (`playwright` isn't
  installed standalone). A path-guard hook blocks the session scratchpad — use `.scratch/`
  (git-ignored). The capture script needs SwiftShader flags for WebGL (already in it).
- The Playwright MCP profile persists the anon cookie; check the JWT sub.
- `.env.local` lacks ALL Whop vars — funnel checkout 503s locally.
- ⛔ Never `npx supabase config push`. Merge-to-main recipe (143 .planning files) in
  session-4's handoff §6.
- The seeded preview thread ("Preview — tested video", `52b05aa9-…`) is still in prod DB.
