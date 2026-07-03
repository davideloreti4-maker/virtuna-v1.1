# Task B2 — REBUILD notes (the Room body was a weak first pass)

> Written 2026-07-03 mid-session, after owner review. **The B2a Room body does NOT match the
> locked v6 prototype — rebuild it, don't extend it.** The seam under it is correct and stays.
> Spec = `docs/prototypes/the-room-prototype-v6.html` (mobile) + `the-room-desktop-v1.html`
> (desktop). Read those FIRST, served over `python3 -m http.server 8899`.

## Status of PR #109 (branch `feat/the-room-focus-archetypes`)

- **Commit 1 `762a5f9c` — the archetype seam. KEEP. It's correct + live-verified.** Card blocks'
  real `personas[]` + `/api/tools/react` personas now flow through `AmbientFocus` → the named cast
  ("Dev" answering in-voice) is real. This is the foundation. Merge-worthy on its own.
- **Commit 2 `b7ddcf1c` — the `AmbientRoom` body. THROWAWAY.** It's a tab-relabel + named voices
  bolted into the OLD analytics panel, not a build to the prototype. **Recommendation: strip it**
  (revert `b7ddcf1c`, or reset the branch to `762a5f9c` and re-open a clean seam PR — do NOT
  force-push under the live auto-wip daemon; branch a clean ref instead per the daemon-hazard rule).
  Then rebuild the Room in a fresh, focused session. `AmbientRoom.tsx` stays in git history as a
  reference for the named-voice-row markup only.

## Where B2a diverged from the prototype (the honest gap)

1. **Not a Bloom.** B2a kept the small bottom-dock panel (~50vh). The prototype Room is a **full
   ~77% sheet that grows UP out of the presence band** into one flush-merged object
   (`#room.bloom` transform in v6). The presence squares its top + drops its top border as the
   Room rises. This is the signature moment — B2a doesn't do it.
2. **Population is the OLD analytics component.** B2a reused `PopulationSwarm` (small
   "500 stopped / 500 scrolled" + a per-archetype breakdown LIST). The prototype Population is:
   **serif hero "500 would stay / 333 would bounce" → 1,000-dot swarm (Play) → stats bar
   (loved/mixed/bounced %) → WEAK-SPOT (the bounced people + their exact words, in coral) →
   Rewrite CTA.** The weak-spot + Rewrite are the value and are entirely missing.
3. **No anchored-focus header.** No stepper `‹ Hook 1 of 3 ›`, no `⤺ compare`, no re-target-in-place.
   The prototype's spine — one card at a time, step/compare — is absent (B2a shows a static score).
4. **Desktop unbuilt.** No persistent right rail; the mobile dock at desktop width reads as broken.
5. **People rows too flat.** Neutral gray avatars, settings-panel feel. Prototype: serif quote is
   the hero with more air + tonal avatars; calm but warm ("group chat with your audience").
6. **No Rewrite lever** anywhere — the payoff of the whole loop.

## The faithful rebuild — plan + the plumbing each piece needs

Build `audience-presence.tsx` to the two prototypes. Reuse the SEAM (real `flatPersonas` on the
focus), `PersonaChatDrawer` (named chat — works), the 1,000-dot swarm GEOMETRY, `personaNameMap`.
Do NOT reuse `AudienceLensContent`/`PopulationSwarm`'s analytics FACE for the Room.

- **Mobile Bloom shell** — a full-width sheet anchored to the band, `transform: translateY`
  open/close (mirror `#room.bloom`/`.up` in v6). The band squares its top when open. Replace the
  current `absolute bottom-full … max-h-[58vh]` panel.
- **Anchored-focus header (stepper + compare)** — NEEDS sibling plumbing the focus contract
  doesn't expose yet: `useAmbientFocus` currently returns only the resolved `focus` concept. To
  step `‹ N of M ›` + `⤺ compare`, the presence needs (a) the current batch's focusable
  descriptors (composer's `ambientDescriptors` — already a flat per-tool list) + (b) the resolved
  focus's `id` + (c) a `focusByTap(id)` step callback (already exists) + a `kindLabel`. Thread
  `focusList` + `focusId` + `onStep` from composer → presence. Compare = a local ranked-list view
  of `focusList`; tapping a row re-targets in place (`focusByTap`).
- **Population rebuild** — compute the hero/stats/weak-spot PURELY from `flatPersonas` (real now):
  stay = round(stop/total·1000), bounce = round(scroll/total·1000); weak-spot = the scroll
  personas + their real `quote` (coral name + serif quote). Keep the 1,000-dot swarm as the viz
  under the hero (reuse `PopulationSwarm`'s deterministic dot geometry, but frame it with the hero
  above, not its own counters). Prototype: `renderPopulation` in v6.
- **Rewrite lever** — NEEDS the originating skill's self-handoff endpoint. `AudienceLensContent`
  already models this (`LensRewrite` prop: `endpoint`/`lever`/`platform`/`onRewrite`) but the
  presence never passes it. Wire the composer to supply a `rewrite` handler (re-POST to the skill
  runner with the Read's lever as steering → new card + Read in-thread). Build-after the visual.
- **Desktop persistent rail** — a two-pane `grid` restructure of `HomePageLayout`/`composer`
  (`1fr var(--rail)`), audience always on screen; idle shows the roster; focusing a card fills the
  rail; `ask →` overlays a chat. Spec = `the-room-desktop-v1.html`. Heaviest — do last, and it's an
  architecture change worth confirming scope on.
- **`variant='thread' | 'surface'`** (contract seam 3, kickoff §5) — build the presence to accept
  it: `surface` = app-wide PEEK band + read-only panel (no composer field to route asks). Keep the
  `<body>`-portal + `position:fixed` pattern.

## Verify (every step, live)

Dev up already this session; else `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack`.
Log in `e2e-test@virtuna.local` / `e2e-test-password-2026`, generate hooks, open the Room, compare
side-by-side with the v6 prototype at :8899. **Test a CALIBRATED audience too** (only General was
checked — renamed people should win over defaults). tsc must stay at the 21 `__tests__` baseline;
keep the matte guard green. Small PR per surface (Bloom → Population → stepper → Rewrite → rail).
