# Start Page — Build Handoff (prototype → real Next.js)

> **Created 2026-07-03** to hand off into a FRESH session that executes the real build.
> Companion to `docs/SURFACES-HANDOFF.md` (milestone scope/sequence) + `docs/THE-CONTRACT.md`
> (the 4 shared seams). This file = "what was decided in the design session + exactly what to
> build first." **Design is signed off; this is an execution handoff.**

---

## 0. TL;DR — what the next session does

Build the **real start page** (replaces today's cold composer `/home`) in Next.js, matching the
**v3 prototype**, and make it **responsive (mobile + desktop)** — the prototypes are mobile-only.
Do it in the order in §4: **stub the contract → build the shell → fill sections**. Lean, artifact-as-spec,
verify live in-browser, small PR. Do **not** build the thread / skills / engine (those are The Room's).

---

## 1. Locked decisions (from the design session — don't relitigate)

- **Direction = v3 "Stanley-referenced, polished."** Owner compared v1 (lean briefing) vs v2 (Stanley-rich) → **chose v2's direction**, then v3 refined it. Build **v3**.
- **Card number = ONE blended number** (`CardReaction.stop`, e.g. "7/10 would watch"). Contract **§6.3 RESOLVED**. The two-signal Craft/Room breakdown lives **inside the Room drill only**, never on the card face. (Relay to The Room — they own the shared card component.)
- **Skin = Juno flat-warm charcoal** — we took **Stanley's layout/IA, NOT its paint.** Stanley is near-black + pure-white + **purple**; we are warm charcoal `#262624` + cream `#ece7de` + terracotta `#d97757` at **near-zero dosage**. **Do NOT introduce Stanley's purple or pure white.** The one sanctioned accent moment in the prototype: the single terracotta ring-arc on the accuracy metric. Everything else neutral.
- **Spine = ambient audience on every card.** Every idea/outlier/slot wears a room reaction ("scored for your people"); the ambient dock is present app-wide; the loop shows predicted-vs-actual. This is the moat and the reason to copy Stanley's shell but not be Stanley.
- **Vocabulary:** Make · Test · Ask (not 13 skills); named people (Maya/Jordan…); plain English (no "SIM"); intent (Grow/Sell) rides the audience, no separate toggle.

---

## 2. The spec IS the prototype (read it first)

- **v3 (current, build THIS):** `docs/prototypes/start-page-prototype-v3.html` · artifact https://claude.ai/code/artifact/2ad8e8db-97b9-48b0-b137-70c0a71aac61
- v2 (pre-polish, for reference): `…-v2.html` · https://claude.ai/code/artifact/aede6705-b97f-4e2a-bc97-e96a801a1fbd
- v1 (lean briefing, rejected direction): `…start-page-prototype.html` · https://claude.ai/code/artifact/88ed7344-c754-49ab-b3d3-3889c0428596
- **The Room** (match its card/dock/room language — one product): `~/virtuna-the-room/docs/prototypes/the-room-prototype-v5.html`

The v3 prototype is a **self-contained HTML** with the exact tokens, section layout, card/dock/room
structure, mock data (contract-shaped), and interactions. **Lift its structure, tokens, copy, and
interaction model directly.** It is directional on pixels — refine while building, keep the model.

---

## 3. ⚠️ DESKTOP GAP — the one thing the prototypes DON'T cover

**All three prototypes are mobile-only (a phone frame).** The real page must be **responsive**. Stanley's
own desktop (from the owner's reference shots) is a **3-column app shell**; mobile collapses it:

| Zone | Desktop (≥1024px) | Mobile (<768px) |
|---|---|---|
| **Left** | existing app icon rail (`src/components/sidebar/Sidebar.tsx`) | hidden → hamburger / bottom nav (existing) |
| **Main column** | greeting · stat row (4 across) · daily-ideas (**2-col grid**) · outliers (3 across) | single column, everything stacked; outliers = h-scroll rail (as in v3) |
| **Right rail (~320–360px, sticky)** | **Calendar (month) · Today's plan · Quick actions** | these flow **into the main column** as stacked sections (as in v3) |
| **Top** | 3 rings centered + theme toggle top-right | same, in the chrome bar |
| **Composer + ambient dock** | floating bottom-center over the main column (dock rides just above it) | pinned bottom, full-width (as in v3) |

- Tailwind breakpoints; design **mobile-first** (v3 is the mobile truth), then add the `lg:` 3-column grid.
- The month **calendar** is the clearest desktop-vs-mobile change: full month grid in the right rail on desktop (Stanley shows this), same grid as a stacked card on mobile (v3 already has it).
- **Open desktop UI call (decide while building):** exact ambient-dock placement on desktop — above the floating composer (mirrors mobile) vs. top of the right rail. *Lean: above the floating composer, so composer+dock read as one object on every breakpoint.*

---

## 4. Build order (do 1–2 THIS milestone-phase; 3–6 after)

Follows `SURFACES-HANDOFF.md §3`. **Ambient-ready, not ambient-blind** — reserve a reaction slot in
every card, stub it to the contract, build fully around it, graft the real atom later.

1. **Stub the contract (first move).** Create the shared TS types + a mock-data module:
   - Types from `THE-CONTRACT.md §3`: `CardReaction`, `Read`, `Reaction`, `ActiveAudience` (+ `Tone`).
   - A `mockRoom` module returning contract-shaped fixtures (reuse the v3 prototype's data verbatim — same named people Maya/Jordan/Priya/Dev/Sam/Kai, same ideas/outliers/receipts).
   - A stub `<CardReaction>` (the inline verdict chip: dot + N/10 + lead) and a stub surface dock — so every section designs against a real (if fake) interface.
2. **The start-page shell (the flagship).** Build `/start` (or repoint `/home`) as the responsive shell:
   greeting → stat row → daily ideas → outliers-to-remix → month calendar → today's plan → quick actions →
   the loop; + the **global ambient dock** + **embedded composer** (Seam 4) + **first-run/empty state**.
   Every card = a door (tap → opens the Room anchored on it — stub the Room open for now; graft real later).
   Composer submit / tapping a card → the launch-into-thread handoff (Seam 4). Verify live. Small PR.
3. **Calendar + pillars** (low-ambient; predicted-score slots).
4. **Post-publish loop — ⏸ DEFERRED TO MILESTONE END (owner call 2026-07-03g).** Do NOT wire mid-milestone. The *write* path is real + wireable (paste-URL → `useOutcomeSignature`). The *read* side the loop renders isn't ours to invent: **§6.1 is now RESOLVED (The Room sign-off) — the predicted-vs-actual DELTA + write-back are ENGINE-SIDE.** So the receipt scalar ("we said 7 · you got 7.2") + accuracy-rising come from a **future engine read-shape we consume**, NOT a metric we define. (Why we can't derive it ourselves today: `predicted_vector`/`realized_vector` are 6-dim normalized SHARE vectors — `signature.ts` normalizes the count away; the stop-of-10 lives on `CardReaction` at sim-gen, not in `outcome_signatures`; the accuracy % exists nowhere — `confidence-gate.ts` emits recalibration proposals, not a user %.) Also empty for the test user (0 outcome rows → renders empty; happy path unverifiable without seeded rows + a scrapeable TikTok URL). **At the very end, gate it: EITHER wire it** (once the engine exposes the delta/accuracy read-shape AND there's seeded outcome data to verify) **OR remove the loop section for launch** (ship without it rather than ship a fabricated number). Until then the section stays as-is (mock, clearly commented).
5. **Feed & Library** ambient echoes.
6. **Graft the atom everywhere** when The Room ships (stub → real, one pass).

---

## 5. Section inventory for the start page (what to build, with data shape)

Each maps 1:1 to a block in the v3 prototype. Mark which are **reserved ambient slots** (stub now, graft later).

| Section | Source of truth / data | Ambient? | Notes |
|---|---|---|---|
| Top chrome | rings (streak / planned / **accuracy=accent arc**), layout icon, theme toggle | — | rings are gamification; keep monochrome line-icons; only the accuracy arc is terracotta |
| Greeting | serif voice-moment ("Good afternoon, {name} 👋" + proactive line) | — | Newsreader serif; the one warm human moment |
| Stat row | real analytics (Views/New followers/Interactions/Posts · L7D + sparkline) | — | may stub numbers first; real source is the connected account. 2×2 mobile, 4-across desktop |
| **Daily ideas** | pre-tested idea cards → each carries a `CardReaction` | **✅ slot** | type-pill (Carousel/Reel) + title + thumb + verdict chip; tap → Room. 2-col grid on desktop |
| **Outliers to remix** | feed outliers scored for your people + Remix | **✅ slot** | perf card (handle/thumb/↗mult/👁views) + `CardReaction` + Remix→launch thread (Seam 4) |
| **Month calendar** | planned/empty slots, predicted-tone dots | **✅ slot** | predicted score = a forecast (honest: Directional). Right rail on desktop |
| Today's plan | planned posts / empty "Add a new idea" | partial | |
| Quick actions | rows → **Make / Test / Ask** verbs (+ Repurpose) | — | line-icons; map to composer verbs |
| **The loop** | receipts "we said 7 · you got 7.2" + accuracy-rising | **✅ our surface** | **⏸ DEFERRED TO MILESTONE END (§4.4) — wire-or-remove gate. §6.1 RESOLVED: delta/accuracy = engine read-shape we consume (not ours to invent), not yet exposed; stays mock until the end call.** |
| **Ambient dock** | `AudiencePresence variant='surface'` | **✅ atom** | import The Room's component; needs user-level active audience (recon #2) |
| **Embedded composer** | `Composer mode='embedded'` + `onLaunch` | **✅ atom** | Seam 4; the ONE contract point → create thread → `/thread/:id` w/ audience+seed |
| First-run / empty | connect-your-account state | — | honest-idle dock; the 3-step loop; composer still live |

---

## 6. Reuse map + the unwired loop (don't rebuild)

- **Import The Room's shared components** (per `THE-CONTRACT.md §4`, don't rebuild): `src/components/audience-lens/` — `AudienceLensContent`, `PersonaChatDrawer`, `PopulationSwarm`, `audience-presence.tsx` (**switcher portaled to `<body>`** — mirror for the app-wide surface dock), `ambient-presence-types.ts`.
- **Composer:** `src/components/app/home/composer.tsx` + `composer-controls.tsx` (SKILLS SSOT). The start page needs a **`mode='embedded'`** entry — coordinate with The Room's composer rework.
- **Audience resolution:** `src/lib/audience/resolve-thread-audience.ts` etc. **Recon #2 (open):** non-thread surfaces need a **user-level active audience** — add it (last-used; `variant='surface'` reads it; entering a thread pins from it).
- **The post-publish loop backend is BUILT but has ZERO importers** — wiring it is our job: `POST /api/outcomes/signature`, `src/lib/flywheel/*`, tables `outcomes`/`outcome_signatures`/`reconciliations`, hook `src/hooks/queries/use-outcome-signature.ts`. Surface (connect / paste-URL / receipts / accuracy) = ours; the reconcile→recalibrate = The Room's (recon #1).
- **Already real (extend, don't recreate):** `/feed`, `/library`, `/audience` (+ `audience-presence.tsx`), `/competitors`, `/referrals`, Grow/Sell intent plumbed. Nav = `src/components/sidebar/Sidebar.tsx`.

---

## 7. Open cross-session items (from `THE-CONTRACT.md §6`)

- **§6.3 card number — ✅ CLOSED** this session (one number). **Relay to The Room.**
- **§6.1 outcome-loop ownership — OPEN.** Proposed: surface = ours, reconcile = theirs. They build-last, timing fine; just don't design it twice.
- **§6.2 user-level active audience — OPEN.** Small but load-bearing; needs The Room's OK (touches audience resolution). Assume the proposed answer to unblock the shell; confirm before the graft.

---

## 8. Setup + gotchas (start here)

```bash
cd ~/virtuna-surfaces                      # branch milestone/surfaces (HEAD be8fe86d as of handoff)
git config core.hooksPath .githooks        # enable hooks
npm install                                # worktrees do NOT share node_modules
cp ~/virtuna-refine/.env.local .env.local  # env is gitignored — copy from a sibling
# Dev — 768MB heap OOMs; the npx wrapper breaks dev. Use the node bin + bigger heap + a free port:
PORT=3400 NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
```
- **Test user:** `e2e-test@virtuna.local` / `e2e-test-password-2026` (login `/login` → lands `/home`).
- **Design system SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. Flat-warm charcoal; matte (no glass/glow); accent near-zero. `BRAND-BIBLE.md`/`docs/tokens.md` are STALE — ignore.
- **Verify live:** Playwright MCP; for the prototypes, `file://` is blocked → serve over `python3 -m http.server`.
- **⚠️ AUTO-WIP DAEMON is active on this branch.** It auto-commits + pushes prototype/doc changes on its own cadence and **diverged origin from local this session**. If you hit a rejected push: **fetch + MERGE (never force-push, never reset)** under the live committer. Land your real code as a normal commit; if the daemon co-opts, branch your clean commit to a new ref + PR rather than fighting it.
- Prototypes + this handoff are committed + pushed on `milestone/surfaces` (`docs/prototypes/*.html`).

---

## 9. Don'ts

- Don't build the **thread / skills / engine** — The Room's (`~/virtuna-the-room`).
- Don't adopt **Stanley's purple / pure-white** — flat-warm charcoal only.
- Don't **rebuild the audience-lens / composer atom** — import the shared components; feed them contract-shaped mock data until the graft.
- Don't skip **desktop** — mobile-first, but ship the responsive `lg:` layout (§3).
- Don't over-ceremony — no heavy GSD; lean, small PR per surface, verify live.

---

## 10. First-session checklist

- [ ] `cd ~/virtuna-surfaces`, `npm install`, copy `.env.local`, dev on **:3400** (§8).
- [ ] Open the **v3 prototype** (artifact or file) + read this handoff + `THE-CONTRACT.md`.
- [ ] Explore current `/home` composer + `Sidebar.tsx` to see what exists.
- [ ] **Step 1:** stub the contract (types + mock module + stub `CardReaction` + stub surface dock).
- [ ] **Step 2:** build the responsive start-page shell against it (mobile = v3; add `lg:` 3-col). Verify live mobile **and** desktop. Small PR.

---

## 11. Build status + graft readiness (updated 2026-07-03k)

### Shipped + merged to `milestone/surfaces` (tip `a5309422`)
- **Steps 1–2** — contract stub + responsive `/start` shell (#105).
- **Nav** — `Start` entry in `Sidebar.tsx` → `/start` (#106). `/home` unchanged (still the thread surface).
- **Pillars** — `ContentPillars` module + pillar-aware plan/calendar (#108).
- **Loop** — DEFERRED to milestone end with a wire-or-remove gate (§4.4).
- **Contract** — SIGNED OFF by The Room (all 4 seams; `THE-CONTRACT.md` §6 all resolved).
- **Connect loop (real) — ✅ MERGED #110.** `/start` first-run detection is now REAL (honesty spine): a user with no calibrated audience (`!is_general && signature != null`) gets the honest "connect your account" state, not a fabricated briefing; connected users get the briefing. Review overrides `?first=1` (force first-run) / `?first=0` (force briefing). The `FirstRun` connect CTA routes to the real calibration flow (`/audience/new` → `@handle` scrape → ~10 named people). Surface-owned, no engine dep. Verified live.
- **Real stat-row (own-account metrics ingestion) — ✅ MERGED #112.** Killed the fabricated stat-row. New `account_snapshots` rig (migration APPLIED to shared Supabase `qyxvxleheckijapurisj`, own-rows RLS) fed by (a) capture-at-calibration + (b) daily cron `/api/cron/refresh-account-snapshots` (07:00 UTC); pure `buildAccountStats` → **Followers / New followers / Likes / Posts** (real counters only, **no fabricated Views**; billions-safe). `/start` renders the real `StatRow` or an honest "gathering your numbers" empty state. **Verified live end-to-end with real Apify data** — both producers (capture writes `following=null` as designed; cron fills it) + all render states; unit 5/5. Files: `src/lib/account-metrics/*`, `src/app/api/cron/refresh-account-snapshots/`, capture in `src/app/api/audiences/calibrate/route.ts`, wire in `src/app/(app)/start/page.tsx` + `src/components/surfaces/{start-page,sections/stat-row}.tsx`.

### ⚠️ Graft-gated — do these WHEN The Room flags each atom as landed (don't stub further)
Swap stub → real, don't rebuild. The Room said it'll flag each atom.
- **Surface dock** — `SurfaceDock` → The Room's `AudiencePresence variant='surface'` (read-only panel per the sign-off delta).
- **User-level audience** — swap `SurfaceDock`'s `MOCK_AUDIENCES`/local state → their `resolveUserAudience`.
- **Embedded composer** — `EmbeddedComposer` → their `Composer mode='embedded'`; **fix the stub `onLaunch` to `(input, verb, audience)` + add an `audience` prop** (contract Seam 4).
- **Card reactions** — the `CardReaction` chip + `RoomDrawer` `Read` → their real card/Read payloads.
- **Feed / Library passive echoes** — a per-item "for your people" verdict needs the sim to have run on each item (engine). **Do NOT fabricate reactions on real feed/library content** (honesty spine). The feed's ambient entry already exists (`Remix → Read`); the passive verdict is a graft, not a stub.
- **The loop** — wire the engine's predicted-vs-actual read-shape (once exposed) OR remove for launch (§4.4 gate).

### Surface-vs-engine split for account-connect + stat-row — ✅ CONFIRMED (2026-07-03k, §6.1-style)
Investigated before building (handoff §4 "confirm the split first"). Two halves, different owners:
- **Connect = SURFACE (ours) — DONE.** There is NO OAuth anywhere; "connect" = capture a `@handle` → public
  scrape (Apify). The real flow already exists (`/audience/new` → `CalibrationFlow` → `/api/audiences/calibrate`
  SSE → frozen `signature` + ~10 named people). We wired the CTA to it + made first-run detection real (above).
- **Stat-row L7D analytics = SURFACE (ours) — ✅ BUILT 2026-07-03k (PR #112).** Ownership re-resolved: "Account"
  + the scraping/cron infra are Surfaces scope; The Room owns the *thread/sim* engine, not account analytics — so
  this was ours, not contested. Built the ingestion slice mirroring `competitor_snapshots`/`refresh-competitors`:
  migration `account_snapshots` (owner-keyed daily counters, own-rows RLS) + capture-at-calibration (seeds the first
  snapshot from the scrape reveal) + daily cron `/api/cron/refresh-account-snapshots` (07:00 UTC) + pure
  `buildAccountStats` (Followers / New followers / Likes / Posts — real counters only, **no fabricated Views**) +
  `/start` server-fetch → real `StatRow` or an honest "gathering your numbers" empty state. Point-in-time real on
  connect; weekly deltas + sparklines accumulate over days. Migration applied to shared Supabase; unit tests 5/5.

### Buildable now WITHOUT the atoms — next-session candidates (recommended order)
1. **Real "Views" tile — ✅ BUILT (PR #114, OPEN → merge next).** The 5th stat-row tile = an honest sum of public
   views across the creator's posts in the trailing **28-day window** (`account_snapshots.recent_views`, migration
   applied to `qyxvxleheckijapurisj`). The daily cron now runs a **second** `scrapeVideos` → `sumRecentViews` (pure,
   unit-tested) → `recent_views`, isolated so a video-only failure still writes the 4 core counters (`recent_views`
   null → tile omitted). `buildAccountStats` appends the tile via `optionalTile` (latest carrying snapshot, or omit —
   never fabricated; three-valued NULL/0/>0). `StatRow` grid is adaptive (`lg:grid-cols-5` with the 5th tile).
   **Verified live w/ real Apify** (zachking → `recent_views` 63,898,300 → /start renders 5 tiles, Views "63.9M",
   5-col desktop / 2-col mobile, no overflow). Unit 13/13; tsc + eslint clean. Files: `src/lib/account-metrics/*`,
   cron `refresh-account-snapshots`, `src/components/surfaces/sections/stat-row.tsx`, migration `*_recent_views.sql`.
2. **Loop write-path (RECOMMENDED NEXT)** — paste-URL → `useOutcomeSignature` (write half is real; the read/accuracy stays engine-gated, §4.4).
3. **Mobile / onboarding polish** — `first-run` is already design-grade; low-lift refinements only.

> The graft tranche (§ above) stays **gated** — The Room's Task B (living-presence rebuild) was **reverted**
> (`86548ccc`), so the real `AudiencePresence variant='surface'` / `Composer mode='embedded'` / Read atoms are
> not landed yet. Don't stub further; wait for The Room to flag each atom, then swap stub → real (one pass).

### Pre-existing infra flag (not a Surfaces code bug)
`milestone/surfaces` Vercel **preview** deploys fail on a **serverless-function-memory limit** (identical on disjoint PRs → project/plan-level). Fix (bump function memory/plan, or trim the heavy route) **before the milestone → main**.
