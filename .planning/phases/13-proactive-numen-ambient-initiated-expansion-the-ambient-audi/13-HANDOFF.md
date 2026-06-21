---
type: handoff
phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi
created: 2026-06-21
updated: 2026-06-21
status: ambient audience REDESIGNED to over-composer panel (UI verified mobile+desktop) · gen-engine UAT pending
branch: milestone/numen-tools
---

# Phase 13 Handoff — Build the Ambient Audience (design locked)

## BUILT 2026-06-21 — REDESIGNED per owner feedback (UI/UX; engine generation down)

The §2 drawer was reworked live into a cleaner **two-state, over-composer PANEL** (owner: not a
drawer, keep it a panel over the composer field; drop the redundant middle page; the composer
field itself is the audience-chat input). Verified on device — **mobile (402×844) AND desktop
(1440×900)** — screenshots in `.planning/sketches/005-audience-scale/p13-build/` (`/v2` = current).

- **Split the Lens** — `AudienceLensContent.tsx` (reusable body) + `AudienceLens.tsx` (thin
  `<Sheet>` wrapper; re-exports `LensRewrite`). Per-card `LensTrigger` + reading-panel doors
  unchanged. The PANEL mounts the SAME `AudienceLensContent` (don't-duplicate).
- **`audience-presence.tsx`** — TWO states (replaced the rejected `ambient-presence.tsx`, deleted):
  - **PEEK** = matte band docked directly above the composer (identity + live breathing
    constellation + pulse: live read when focused / readiness when idle, never stale).
  - **PANEL** = expands UPWARD over the composer (anchored, flush with the peek band; **NO
    scrim, NO drawer** — the composer stays usable below). One surface: the shipped
    `<AudienceLensContent>` (The Read + Panel·10 ⇄ Population swarm + replay + cluster + per-
    persona chat + Rewrite) for the current focus, an idle hero when none, and a **"Your asks"
    conversation** (each turn → re-focus). Owns audience switching.
- **Composer is the audience-chat input** (`composer.tsx`): when the panel is open the field's
  placeholder → "Ask your audience…" and submit routes to `askAudience` → `POST /api/tools/react`
  → appends a turn + `focusByThought` so the Lens shows the room's read. Closed = normal skill
  input. Audience chip already retired from `composer-controls.tsx`.
- **Live-verified end to end:** typed "I quit my job to sell candles" in the composer → panel
  showed the real reaction (Population 400/600 swarm + Panel·10 constellation + verbatim quote),
  peek pulse updated to "4 of 10 would stop". NOTE: `/api/tools/react` WORKS (≈35s); it's the
  hooks/ideas **generation** path that's down (§1 deferred).
- **Tests** — `audience-presence.test.tsx` (rewritten, 13) + `home`/`composer-controls`/
  `use-ambient-focus`/`thread` suites green (117 across the sweep). Source typecheck + lint clean.

**Still pending (needs the generation engine):** `13-UAT.md` + phase verifier (card-generation
paths); the `PROACTIVE-01/02` morning-drops/scheduled half of P13 (not built).

---

## TL;DR for the fresh session

1. The prior "render bug" is **RESOLVED** — and it was **not** a render/PATCH/SSE bug. The
   real cause: the Phase-14 **rubric critic failed ~100% of candidates**, so hooks/ideas
   returned **0 blocks every run** → blank home. Now **deactivated** (owner decision) →
   skills produce output again. Details in §1.
2. **Mission: rebuild the ambient audience to the LOCKED design in §2.** Do NOT patch the
   old `ambient-presence.tsx` strip — replace it. The design is decided; build it.
3. Reuse the **ONE shipped AudienceLens** (don't duplicate). Re-verify against `13-UAT.md`
   + re-run the phase verifier when done.

---

## 1. Prerequisites already done this session (do NOT redo)

All committed on `milestone/numen-tools` (auto-wip checkpoints + your own commits).

- **Rubric critic deactivated (the real "render" fix).** Measured: the critic failed every
  candidate — even SIM-Strong 6/10-stop hooks — so the combined gate (`band !== "Weak" AND
  verdict.pass`) returned 0 blocks. Now behind `isRubricCriticEnabled()` in
  `src/lib/engine/flash/rubric-critic.ts` → env `RUBRIC_CRITIC_ENABLED`, **default OFF**.
  `hooks-runner.ts` + `ideas-runner.ts` skip the call when off (no extra API hit) and gate
  **band-only** (`band !== "Weak"`). Critic code + contract tests kept (best-of-n.test.ts
  opts the flag on) — re-enable anytime. Verified: pipeline returns 5 blocks, 82 runner/
  route tests pass, source typecheck clean. See memory `rubric-critic-deactivated`.
- **Render-after-reload fixed.** `activeTool` reset to `"test"` on reload stranded persisted
  idea/hook/script/remix cards (layout went thread-mode, every view gate false → blank home).
  Now `composer.tsx` restores the most-recent persisted card's tool on rehydration (guarded
  by `hasUserSelectedToolRef`).
- **PATCH 500 fixed.** Selecting a preset audience PATCHed a non-UUID (`preset-growth`) into
  the `uuid` column `threads.active_audience_id`. Now UUID-guarded client-side
  (`UUID_PATTERN` in composer) + route returns a clean 400 (`z.string().uuid()`).

### Deferred — NOT this phase, but real (tracked in memory)
- **Latency:** ~110s/hook-run even critic-off (one batch). Dominated by reasoning-gen
  (`qwen3.7-plus`) + 8-way SIM fan-out, NOT the critic. Owner wants <5s/100% → separate
  engine track (faster gen model + SIM parallelism).
- **Generation reliability:** ~2 of 3 direct `runHooksPipeline` runs threw on the Qwen
  generate call (transient; route catches → SkillRunError, not silent). Needs retry/fallback
  for "output 100% of the time."

---

## 2. THE LOCKED DESIGN — Ambient Audience (decided 2026-06-21)

**Concept:** a persistent, premium audience **PRESENCE** that is the always-on **front door
to the ONE shipped AudienceLens**. It is **one panel at three heights** (iOS sheet-detent
model), **docked on the composer**. Mobile-first.

### The three detents (one continuous panel — "opens further")
- **PEEK (at rest).** A real GlassPanel band (composer's visual weight — **NOT** the old
  `h-[3px]` ribbon), docked **directly above the composer**, travels with it (both bottom-
  pinned on mobile). Contains:
  - **Audience identity** — name + a small **live persona constellation** (the 10 panel
    dots/avatars) breathing/drifting subtly so it feels alive even when idle.
  - **One-line pulse** — when there's a draft / last card → a live read ("3 of 10 would
    stop"); when idle → **readiness, NOT stale reactions** ("General · 10 personas ready").
  - Affordance to open (tap / drag up / chevron).
- **PREVIEW (tap/drag up).** Taller sheet showing a **slice of the room**: a few live persona
  reactions + quotes to the current focus, and a compact **"ask your audience…"** chat entry.
  This is a **preview + door**, not a reimplementation — chat send / deeper actions route into
  the shipped Lens.
- **FULL (drag further / "Open the room →").** The panel renders the **shipped `<AudienceLens>`
  content** (The Read + Lever, Panel·10 ⇄ Population·1,000, replay/swarm, sticky "Rewrite for
  this audience →"). **Same component, no duplicate.**

### Locked decisions (the four forks + the Layer-3 question)
1. **Dock = ON the composer** (above the input), bottom-pinned with it on mobile. NOT
   top-of-page (detached, fights the header).
2. **Expansion depth = keep the intermediate PREVIEW** (peek → preview → full), not tap-
   straight-to-Lens.
3. **Identity/switching = the PRESENCE owns it.** The composer's locked icon-only audience
   chip (`composer-ux01`) **retires** — the audience control moves into the presence.
   (Reconcile the composer layout accordingly.)
4. **Empty-home (Branch B) = show the PEEK presence** (identity + "ready"), docked above the
   centered composer. **NO stale "reacting to…", NO second text input.** (This was the
   rejected version's core failure.)
5. **Layer 3 lives in the SAME panel** as its largest detent (renders the shipped Lens
   content), so it feels like one object the creator keeps opening — not a separate modal
   that jumps in over the top.

### Behavior
- **Alive mechanic:** reacts to **focus** — what you're typing (type-to-room, debounced) or
  the card you tapped — via the existing `useAmbientFocus` + `POST /api/tools/react`
  (`buildReactionPanel`). Pulse + constellation reflect the focus.
- **Thread (Branch A):** presence sits above the composer at the bottom; thread scrolls
  above; pulse reacts live to thread/draft.
- **Per-card LensTriggers RETAINED** as a second door (card-level): a card's trigger opens
  the same Lens focused on *that* card; the presence opens it on the *current/overall*
  audience. Same content, two entry points.
- **Don't-duplicate rule:** every door (presence FULL detent, per-card `LensTrigger`, chat)
  mounts the ONE shipped Lens content.

---

## 3. What exists — reuse vs. replace

### REUSE (the ONE shipped AudienceLens — P9, live & verified; do NOT rebuild)
`src/components/audience-lens/`:
- `AudienceLens.tsx` (shell), `PopulationSwarm.tsx`, `ReplayController.tsx`, `ClusterView.tsx`,
  `PersonaChatDrawer.tsx` (chat), `lens-derive.ts`, `use-lens-scale.ts`, `card-rewrite.ts`,
  `flat-card-reactions.ts`, `card-reaction-at-rest.tsx`, `LensTrigger.tsx` (per-card door).
- **Build implication:** `AudienceLens.tsx` is currently a self-contained **sheet**. **Split
  the Lens CONTENT from its SHEET WRAPPER** so the content mounts in (a) the presence FULL
  detent and (b) per-card `LensTrigger` openings — both rendering the *same* content.

### REUSE (focus engine)
- `src/components/app/home/use-ambient-focus.ts` — type-to-room / tap focus logic. Keep;
  rewire to the new presence.
- `POST /api/tools/react` (`src/app/api/tools/react/route.ts`) + `buildReactionPanel`
  (`src/lib/engine/flash/build-reaction-panel.ts`) — the live reaction source.

### REPLACE / RETIRE (the rejected P13 strip)
- `src/components/audience-lens/ambient-presence.tsx` (23.7K strip) + `ambient-presence-types.ts`
  — rework into the detent presence (salvage what's useful, drop the ribbon/stale-reaction/
  competing-input approach).
- `composer.tsx` mounts: `ambientPresenceStrip` (~L888), Branch-A render (~L1250), Branch-B
  empty-home render (~L1269). The **Branch-B empty-home strip was the worst offender** — drop
  it / replace with the PEEK presence.
- Retire the composer's icon-only audience chip (`ComposerControls` audience control) → moves
  into the presence (fork #3).

---

## 4. Suggested build sequence
1. **Re-serve sketch 005** (canonical premium reference):
   `cd .planning/sketches/005-audience-scale && python3 -m http.server 8799` →
   `http://localhost:8799/index.html`.
2. **Split** the AudienceLens sheet → reusable Lens **content** component (no behavior change;
   verify the per-card `LensTrigger` path still opens it).
3. **Build the detent presence** (peek/preview/full) as the new ambient component; mount the
   Lens content at FULL.
4. **Dock** it on the composer; wire identity + switching into it; **retire** the composer
   audience chip.
5. **Wire alive** via `useAmbientFocus` + `/api/tools/react`; empty-home = PEEK-ready only.
6. **Verify:** generate a fresh Hooks thread → cards paint (critic is off now) → presence
   reacts → peek→preview→full opens the Lens → per-card LensTrigger still works.
   Run `13-UAT.md` on device → re-run the phase verifier → mark Phase 13 complete.

---

## 5. Environment / how to drive
- Worktree `/Users/davideloreti/virtuna-numen-tools`, branch `milestone/numen-tools`.
- **Dev:** `npm run dev` → http://localhost:3000 (was running this session; log `/tmp/p13-dev.log`).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <paths>` (NOT `npm test` — prints fake PASS(0)).
- **Test user:** `e2e-test@virtuna.local` / `e2e-test-password-2026` (comedy/storytelling
  profile; `npx tsx e2e/create-test-user.ts` to ensure). Account had only old Explore/
  multi-audience threads — generate fresh.
- **Critic stays OFF** by default (unset env). To experiment with it on: `RUBRIC_CRITIC_ENABLED=true`.
- **Hook generation is slow (~110s) + occasionally throws** (gen reliability, §1 deferred) —
  budget for it when driving the browser; retry once past a transient gen failure.
- **Screenshotting the animated Lens:** freeze first (`requestAnimationFrame/setTimeout/
  setInterval = ()=>0`, `svg.pauseAnimations()`, inject `*{animation:none!important}`), or
  drive with reducedMotion.

## 6. Verification / phase state
- Phase 13 NOT complete. `13-VERIFICATION.md` = `human_needed`; `13-UAT.md` = 6 items pending;
  `13-REVIEW.md` = 0 Critical / 4 Warning / 3 Info.
- Pre-existing (NOT P13): 48 `__tests__`/fixture typecheck errors (test debt, unrelated) + 3
  failing `audiences/__tests__/route.test.ts` (DELETE→415, from `fix(12) csrfGuard`).
