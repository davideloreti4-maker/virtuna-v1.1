---
type: handoff
phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi
created: 2026-06-21
status: paused — ambient UX rejected by owner; rebuild required
branch: milestone/numen-tools
---

# Phase 13 Handoff — Ambient Numen needs a rebuild (not a patch)

## TL;DR for the next session

The P13 ambient layer was **built and behaviorally correct but the UX is wrong** and the owner
rejected it. Do NOT keep patching `ambient-presence.tsx`. The plan:

1. **FIRST: fix a real generate→render bug** (below) — without it you can't see fresh output.
2. **Then rebuild the ambient audience** to the owner's vision + the locked **sketch 005**.
3. Re-verify against `13-UAT.md` (6 items) and re-run the phase verifier.

Phase 13 is **NOT complete** (verifier returned `human_needed`; UAT never run).

---

## 1. The owner's ambient vision (verbatim intent — this is the spec)

> floating, visible at all times — either sitting on top of the composer field or on top of
> the page. ambient audience should be in thread, but **as a panel, same as the composer**.
> premium UI/UX, needs to **feel alive and interactable** — you can **tap on it and the panel
> opens further and you can see the reactions, you can chat and interact with it**, and more.
> Every door opens the **ONE shipped AudienceLens** (do not duplicate it).

Decoded into requirements:
- **Always-on floating presence** — docked on the composer or page top; never a stale strip on an
  empty void.
- **In-thread = a real PANEL** (same visual weight/treatment as the composer panel), not the thin
  `h-[3px]`-ribbon strip that shipped.
- **Premium + alive** — motion, reactions visible, tappable.
- **Tap → expands → reactions + chat + interact** → opens the shipped `AudienceLens`.

### What's WRONG with the shipped P13 ambient (why it was rejected)
- Mounted on the **empty/centered home (Branch B)** where there are no cards → renders a
  redundant strip + a stale `reacting to: …` floating over an empty void + a second text input
  competing with the composer. **Drop the empty-home mount.**
- It's a thin strip, not the premium panel the owner asked for.
- It does not act as the always-on **front door** to the rich P9 Lens.

---

## 2. The locked design target — sketch 005 (the P9 AudienceLens)

Canonical premium reference. Serve + view it:
```
cd .planning/sketches/005-audience-scale && python3 -m http.server 8799
# open http://localhost:8799/index.html   (already running this session)
```
Sketch = card feed → **"Open the room →"** → AudienceLens sheet:
1. **The Read** — one-line interpretation + **Lever** (what to change). Foresight, not a chart.
2. **Panel · 10 ⇄ Population · 1,000** toggle — Panel = named-persona constellation + ripple +
   reaction feed + chat ("focus-group glass"); Population = dense 1,000 swarm, geographic
   sentiment (coral regions), propagation cascade on Play.
3. Sticky **"Rewrite for this audience →"** (closes into regenerate — the flywheel).

### P9 IS built and live (verified this session — don't rebuild it)
The AudienceLens renders live with Panel·10/Population·1,000, 10 named archetypes, **Replay
reactions**, by-segment clustering, and **"Ask them why →" chat per archetype**. Components:
- `src/components/audience-lens/AudienceLens.tsx` (shell), `LensTrigger.tsx` (per-card door),
  `PersonaChatDrawer.tsx` (chat), `PopulationSwarm.tsx`, `ReplayController.tsx`, `ClusterView.tsx`,
  `lens-derive.ts`, `use-lens-scale.ts`.
- **Mounts:** video Reading → `reading-panels.tsx` (~L243-274, `role=button aria-label="Open the
  living audience lens"` wraps the demoted `PersonaGraph`; the segment list below is the OLD
  readout — that's the thing that looked "old"). Text skill cards → `LensTrigger` in
  `idea/hook/script/remix-card-block.tsx` + `personas-block.tsx`. The **Read + Rewrite** appear on
  the **text-skill** surfaces (omitted on the video Test surface by design).
- Discoverability is poor (premium Lens hidden behind a small graph tap, under the old segment
  list). The ambient layer should become the visible front door to it.

---

## 3. ⚠ FIX FIRST — generate→render bug (blocks everything)

Generating hooks via the composer **does not render**:
- `POST /api/tools/hooks` works (200, SSE streams, ~2.5s — verified via authed in-browser fetch).
- But the composer leaves the home **empty** — no cards painted, no thread created, no navigation.
- Server log shows `PATCH /api/threads/60f116a7-b18f-42c7-a0b0-36f2eaa46c5f 500` (open-thread
  update failing). The open-thread flow is broken for the e2e account (possibly stale data).

Where to look:
- `src/components/app/home/composer.tsx` — submit handler: `GET /api/threads/open` (~L308),
  `PATCH /api/threads/${openThreadId}` (~L386), the SSE consume + card append + thread render.
- The `PATCH /api/threads/[id]` route handler — get the 500 stack (add logging / reproduce).
- Try `New Thread` (resets the open thread) before generating — may be stale-data only.
- Confirm whether cards persist server-side but the client never appends (SSE render path) vs.
  never persist (the 500 blocks association).

---

## 4. P13 work already on the branch (commits, milestone/numen-tools)

- `13-01..13-04` — ambient build: `POST /api/tools/react` (`react/route.ts`), `buildReactionPanel`
  (`engine/flash/build-reaction-panel.ts`), `CardReactionAtRest`, `AmbientPresence`
  (`audience-lens/ambient-presence.tsx` + `-types.ts`), `useAmbientFocus`
  (`app/home/use-ambient-focus.ts`), composer mount.
- `ba53d318` — fix(13): review WR-01/WR-03/WR-04 + IN-02. **WR-02 deferred** (react route uses
  `createOpenThreadLazy` get-or-create → should be read-only `getOpenThread`; persists a thread on
  a "reaction", contradicting the ephemeral guarantee — owner never green-lit the behavior change).
- `206d1e39` — test(13): persist `13-UAT.md` + `13-VERIFICATION.md` + `13-REVIEW.md`.

### ⚠ Regression I introduced and did NOT finish (likely MOOT after rebuild)
`ba53d318`'s WR-01 fix added `useEffect(() => setTypedFocus(null), [focus])`. Side effect: the
honesty caption ("A quick SIM read on your {audience} — not a full Test.") is gated on
`typedFocus !== null`, so it **vanishes** once the composer round-trips focus back. Proper fix:
clear `typedFocus` only when the parent drives a **different** concept; **keep it on the self-echo**
of the same typed thought. (Skip if `ambient-presence.tsx` is being replaced in the rebuild.)

---

## 5. Verification / review state
- `13-VERIFICATION.md` — `human_needed`, 24/24 must-haves in code (behavioral, not UX-judged).
- `13-UAT.md` — 6 device-UAT items, all `pending`.
- `13-REVIEW.md` — 0 Critical / 4 Warning / 3 Info.
- Phase NOT marked complete in ROADMAP/STATE.
- **Pre-existing, NOT P13:** 3 failing tests in `src/app/api/audiences/__tests__/route.test.ts`
  (DELETE → 415) from `fix(12): add csrfGuard` — Phase 12 test debt. Worth a separate fix.

---

## 6. Environment (what's running / how to drive it)
- Worktree `/Users/davideloreti/virtuna-numen-tools`, branch `milestone/numen-tools`.
- **Dev server**: `npm run dev` → http://localhost:3000 (was running; log `/tmp/p13-dev.log`).
- **Sketch server**: `python3 -m http.server 8799` in `.planning/sketches/005-audience-scale/`.
- **Test user**: `e2e-test@virtuna.local` / `e2e-test-password-2026`
  (ensure via `npx tsx e2e/create-test-user.ts`). Browser had a live session; account data is
  **5–6 days stale** (only old "Simulation"/video Test threads — generate fresh, don't judge old).
- **Tests**: `node ./node_modules/vitest/vitest.mjs run` (NOT `npm test` — prints fake PASS(0)).
- **Screenshotting the animated Lens**: it never goes "stable" (live swarm/replay). Before
  `browser_take_screenshot`, freeze in page context: `requestAnimationFrame/setTimeout/setInterval
  = ()=>0`, `svg.pauseAnimations()`, inject `*{animation:none!important;transition:none!important}`.
  Or drive with `reducedMotion`.
- `DASHSCOPE_API_KEY` is in `.env.local` (live Flash/engine works in dev; the test runner just
  doesn't load it → 20 skipped LIVE tests).

## 7. Recommended next-session sequence
1. Fix the generate→render / `PATCH /api/threads` 500 (§3). Verify a fresh Hooks thread paints
   cards + the per-card Lens opens.
2. Compare that live Hooks card+Lens to sketch 005; confirm The Read + Rewrite render on text cards.
3. **Re-plan the ambient UI** to §1 (floating always-on panel; drop empty-home strip; tap →
   expand → reactions + chat → opens the shipped AudienceLens). This likely supersedes
   `ambient-presence.tsx`'s strip approach — treat as a P13 UI re-plan / gap phase.
4. Build → run `13-UAT.md` on device → re-run verifier → complete the phase.
