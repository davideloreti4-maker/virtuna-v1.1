# HANDOFF — Maven landing / $1-trial offer page (2026-07-22)

**Worktree:** `~/virtuna-maven-offer` · **Branch:** `lane/maven-offer` (based on `lane/skill-cards-prod`, which == `main` via PR #355) · **Dev:** `:3020` · **Route:** `/go`

---

## TL;DR — what this is

A **cold-social → `$1 / 3-day trial` offer page** for Maven, built to convert TikTok/IG link-in-bio traffic at **10%+ viewer→trial**. It is SEPARATE from the existing considered `(marketing)` page — different audience (impatient, mobile, one scroll). Ships at **`maven.numenmachines.com`** (a subdomain; Maven name kept, Numen = quiet house brand in the footer).

**The hero renders the REAL product** — the shipped `VideoTestCardRenderer` — not a marketing mock. It auto-updates when the card design changes (imports the live component). This was an owner pivot away from a synthetic canvas mock; reason: authenticity/trust + auto-update + shows real value.

**✅ DONE + live-verified this session:** the real Test card renders on `/go` (HTTP 200, 0 console errors, screenshot premium). See "Current state" below.

**▶ NEXT (owner-directed, this is your job):**
1. **Guided build-motion** on the card (the "wow" choreography) + general motion.
2. **Add the simulation cards — brain + population — visible** beside/below the Test card (the `AmbientRoom` component; already on this branch).
3. Rest-of-page premium pass (transformation → pricing → FAQ).

---

## Locked decisions (do NOT relitigate)

- **Name = Maven, domain = `maven.numenmachines.com` subdomain.** Owner rejected buying a new domain / renaming (link-in-bio never types a URL). Numen = house brand, quiet endorsement only.
- **Base branch = `lane/skill-cards-prod`** (== main). The landing MUST live on the same branch as the card renderer so the auto-update works. Rebase onto `main` cleanly before PR.
- **Hero = the real card, not a mock.** Import the shipped renderer; never screenshot/copy the design.
- **Accent dosage is LOCKED** (`globals.css`): coral `#FF6363` = a LIVENESS signal only (live dot, the drop moment) — **never** primary buttons. Primary CTA = CREAM (`--color-action`). ⚠️ Owner *may* want a bolder coral CTA for conversion — FLAGGED, not yet decided. Ask before overriding.
- **Pricing psychology** (SSOT `src/lib/pricing.ts` — Creator $49 / Pro $99 / Studio $499, `$1·3-day`, 50-credit trial cap): choreograph the 3 plans so ~everyone lands on **Pro** (freedom-of-choice as a feeling, one real destination); founding-price strikethrough anchors; add an **annual toggle** ("2 months free" — currently monthly-only); the `$1` is a *decision-shrinker*, not a discount.
- **⚠️ Fictional social proof must NOT ship.** The "2,000+ creators" claim + testimonial identities are fake (per `docs/PRICING.md`). Use the TRUE anchor: "trained on 500 dissected viral videos." No fake counts, no fake countdown timers — honest FOMO only (the open loop + a real founding-price cohort).

---

## Current build state

**Files (all on `lane/maven-offer`, committed this session):**

| File | Role |
|---|---|
| `src/app/(offer)/layout.tsx` | Bare dark pass-through layout for the group; imports `offer.css` |
| `src/app/(offer)/offer.css` | Scoped keyframes (`mavenPulse`, `mavenScan`, `mavenShimmer`, `mavenGain`) — for motion |
| `src/app/(offer)/go/page.tsx` | The offer page: slim brand bar + hero (copy left, `<ProductRender/>` right) |
| `src/components/offer/product-render.tsx` | **The hero centerpiece.** Wraps `VideoTestCardRenderer` in a throwaway `QueryClient` + browser-window frame (mini thread: "test this video for me" → Maven → the card). Non-interactive (`pointer-events-none`), bottom fade. |
| `src/components/offer/test-card-fixture.ts` | The card's props — a COPY of the `/dev/cards` `video-test-card` fixture. Design auto-updates via the import; DATA is a snapshot (see NEXT-T4). |
| `src/components/offer/read-stage.tsx` | **SUPERSEDED** synthetic mock (the pre-pivot canvas "read"). Unused. Deletable — kept only in case the motion work reuses its curve/room logic. |
| `src/components/velora/*` | 7 copied Velora UI components (MIT): `number-ticker`, `blur-fade`, `border-beam`, `iphone-mockup`, `aurora-background`, `shimmer-button`, `animated-gradient-text`. |

**Why the QueryClient wrapper:** `VideoTestCardRenderer` embeds `<SaveAffordance>` which calls `useSaveItem()` (react-query) at mount → needs a `QueryClientProvider`. Nothing fires unless clicked, and the card is `pointer-events-none`, so the dead Save/Simulate links never trigger. This is the ONLY provider the card needs on a public route.

**Verified:** `/go` → 200, all card content in SSR (craft 77, filmstrip, drop flag, working/not-working, "Simulate with your audience →"), 0 console errors, Playwright screenshot confirms premium look.

---

## How to run + verify

```bash
cd ~/virtuna-maven-offer
# env is per-worktree + gitignored — copy from trunk if missing:
[ -f .env.local ] || cp ~/virtuna-v1.1/.env.local .env.local
rm -rf .next
node --max-old-space-size=2048 ./node_modules/next/dist/bin/next dev -p 3020
# then open http://localhost:3020/go
```
- **Dev server gotcha** ([[dev-server-launch]]): direct-node not npx; `rm -rf .next` + restart clean after any branch switch; dies on memory pressure.
- **Verify interaction** with raw Playwright (`animations:'disabled'`) or `browser_evaluate` DOM asserts — NOT `browser_take_screenshot` blindly (this app's ambient animations can hang the stability wait; the offer page itself is calmer so a fullPage screenshot at 1280×900 worked this session).
- The **"N" bottom-left in dev** is Next 16's dev indicator — not part of the page, gone in prod.

---

## NEXT — prioritized, with technical specifics

### T1 · Guided build-motion (the wow) — START HERE
The card renders but doesn't *flash*. Lead the eye through the dense card in ~3s:
> thread bubble types "test this video for me" → Maven label appears → the card **assembles top-down** (header → filmstrip → ledger → fixes, each `BlurFade`-in staggered) → the **craft ring counts up to 77** (`NumberTicker` from `@/components/velora/number-ticker`, or animate the SVG `strokeDashoffset`) → driver bars fill their widths → the **0:06 drop flag pulses** (coral, the one sanctioned accent moment) → "Simulate with your audience →" gets a subtle glow/`BorderBeam`.

- Motion lib is `motion/react` (v12, already in the app). Use `motion.div` variants with `staggerChildren`, keyed so it replays; respect `prefers-reduced-motion`.
- The card is the SHIPPED component — don't fork it to animate. Wrap/overlay motion at the `ProductRender` level (animate the container reveal + overlay the ring count-up), OR drive a lightweight "assembling" scrim. Keep the real card as the source of truth.
- Keyframes already scaffolded in `offer.css`.

### T2 · Brain + population simulation cards visible (owner-requested)
Render the **`AmbientRoom`** component (the shipped audience panel: **brain ⇄ people ⇄ population**) next to / below the Test card. **It's already on this branch** — no ambient-v2 cherry-pick needed.
- Import: `import { AmbientRoom } from "@/components/audience-lens/AmbientRoom"`.
- Copy the fixture from `src/app/(app)/dev/cards/page.tsx` — see `ROOM_FOCUS` (personas + conceptText + fraction) and how it's mounted (`<AmbientRoom flatPersonas={...} conceptText=... fraction=... kindLabel="Hook" .../>`). There's also a grounded variant using `DEV_BRAIN_SOURCE` (needs `/dev/sample-video.mp4`, which is **gitignored/absent** → use the NON-grounded personas-only mount for the landing; no asset dependency).
- Also available: `AudiencePresence variant="rail"` (the persistent rail with `RAIL_FOCUS`/`RAIL_SIBLINGS`) — good for the "population" scale.
- **Verify its provider needs** first (it likely needs the same QueryClient; may want Tooltip). Mount it inside the same `QueryClientProvider` as the card; add `TooltipProvider` only if a context error appears.
- **Responsive intent (owner):** desktop = ambient sits BESIDE the card; mobile = ambient is a SHEET on top, NOT always open. Build both honestly (the real app behaves this way).
- This makes the hero show the FULL loop: **Test (craft) + Simulation (brain/population reception)** — the two-surface story ([[test-vs-simulation-split]]).

### T3 · Rest of the page (premium pass)
Below the hero: **transformation** (before/after "one gambles, one knows") → **how it works (3 steps)** → **pricing** (choreographed Pro, `$1` anchor, annual toggle, founding price) → **FAQ** (the 3 objections at the CTA) → final CTA + "A Numen Machines product" footer + sticky mobile CTA. Use Velora sections (`BlurFade`, `BorderBeam` on the Pro card, `Marquee`, `BentoGrid`) themed to charcoal+coral. The pre-pivot synthetic mock (published Artifact `https://claude.ai/code/artifact/fe52b3b6-fd74-4235-a179-d3c4cb651eb1`) has the section structure + copy to lift.

### T4 · True data auto-update (fixture share)
Extract the `/dev/cards` inline `video-test-card` props (page.tsx) into `src/app/(app)/dev/cards/fixtures.ts` as an export, import it in BOTH page.tsx and `test-card-fixture.ts`. Then the landing's card DATA (not just design) auto-updates. Low-risk refactor consistent with how the other block fixtures already live there.

### T5 · Open decisions for the owner
- **CTA color** — cream (dosage-compliant) vs a bolder coral conversion variant? Flagged, undecided.
- **Composition** — full tall card (fade teases "more" = open loop) vs cap to header+filmstrip+"see the fixes →". Owner said "we'll have to see it" — iterate live.
- **ambient-v2** (`design/ambient-audience-v2`) — the NEWER ambient redesign is NOT needed for T2 (use the shipped `AmbientRoom`), but if the owner wants the v2 look, cherry-pick `src/components/audience-lens/v2/*` later.

---

## Gotchas
- **Providers:** the card needs `QueryClientProvider` (SaveAffordance). AmbientRoom likely same. Don't import the whole app `Providers` (it mounts `CreditWallListener`); use a local throwaway `QueryClient`.
- **Dosage rule is LOCKED** — cream primary action, coral only for liveness/drop. Ask before a coral CTA.
- **Fictional proof** — never ship the fake creator counts/testimonials.
- **tsc vs dev:** Next dev (SWC) skips type errors. Run `node ./node_modules/typescript/bin/tsc --noEmit` before PR.
- **Fixture is a snapshot** until T4 — changing the dev/cards fixture won't move the landing's data yet (design does).

---

## Strategy appendix (so the GTM thinking isn't lost)
- **Funnel:** video hook → tap → offer page (same promise, PROVEN by the real card render) → `$1` reframe (decision shrinks to "worth a dollar?") → choreographed plan pick (Pro) → Google one-tap + card → checkout → in-app first-run wow.
- **The wow = prediction-as-magic-trick** + the **open loop** (see the verdict free, the value locked). Honest FOMO only.
- **Anti-abuse before the push:** card/device/IP dedup (current guard is per-account only — `docs/PRICING.md` flags it); turn on Upstash rate limits; publish a `/trial-policy` page.
- **Time-to-value:** force a first Reading on a SAMPLE video in onboarding so a cold user hits the wow before their 50 trial credits run out.
- Full competitive/best-practice research + the pricing psychology toolkit are in the session thread and [[maven-landing-offer-page]] / [[pricing-strategy]].
