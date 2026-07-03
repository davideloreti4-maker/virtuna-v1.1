# Task B — PR-2+ handoff (the Room body is REBUILT; continue the surface sequence)

> Written 2026-07-03 at ~37% context. **PR-1 (the v6 Bloom Room body) is DONE, verified live,
> owner-reviewed, and shipped as PR #111.** This doc hands off the REMAINING surfaces. The design
> is LOCKED — the local prototypes are the spec. Build TO them, don't re-derive (one earlier
> re-derivation — swapping the prototype's green for cream — was caught in review and reverted;
> **when in doubt, match the prototype exactly**).

## ★★ SESSION UPDATE (2026-07-03 later) — PR-2 SHIPPED → next = PR-3

**PR-2 (anchored-focus stepper + `⤺ all N` view-all) DONE → PR #115** (`feat/the-room-stepper`
off `feat/the-room-composer`, commit `f53c7052`, base = `feat/the-room-composer`). 5 files, exactly
the §3 plan: `id?` on `AmbientFocus` + `AmbientFocusSibling` (`ambient-presence-types.ts`) · `toFocus()`
carries the id (`use-ambient-focus.ts`) · composer threads `focusList={ambientDescriptors}` +
`onStep={focusByTap}` + `kindLabel` (Hook/Idea/Script/Remix from `activeTool`) · `AudiencePresence`
forwards → `AmbientRoom` renders v6 `renderDrillHead` (‹ Hook N of M › steps IN PLACE + `⤺ all N`) +
`renderCompareHead/Body` (ranked "How the room ranked your N", sorted by parsed stop-count best-first,
meter tone = prototype `toneOf` sage≥60%/coral≤40%/neutral). **Honesty: a typed thought has no id → no
stepper.** Zero new model calls. **VERIFIED LIVE**: General (5 hooks — step, `⤺ all 5` compare, tap-row
re-target+return-to-drill, thought→no-stepper) AND calibrated Fitness Creators (fresh gen, varied
**7/6/5/5/2** → correct ranking + green/neutral/coral meters, voices ride along on step, re-target
updates serif 5→7). Side-by-side vs v6 = faithful. tsc 21 baseline; presence+focus 34, matte 14 green.

**POLISH items from the audit below = effectively already satisfied by PR-1** (don't re-open): the
People avatar sage IS `rgba(142,166,138,.16)`/`#a6bfa1` (PR-1 fidelity fix `3c7ab746`); "▶ Replay"
renders; the footer reads "Your N people" — the HONEST copy, since PR-1 shows all voices (the prototype's
"+N more of your 10" implies hidden voices there aren't). Bumping sage brighter would re-derive past the
LOCKED dosage. So the only real remaining interaction is **PR-3 (Rewrite)**.

**➡ NEXT SESSION (start COLD, full budget — PR-3 is backend-touching): PR-3 — Rewrite lever.** Full
plumbing in §3 below ("PR-3 — Rewrite lever on the Population weak-spot"). Branch off `feat/the-room-stepper`
(inherits PR-2). Wire the existing `AudienceLensContent` `LensRewrite` contract (`endpoint`/`lever`/
`platform`/`priorStopCount`/`priorTotal`/`onRewrite`) + mirror `RewriteCta` in `AmbientRoom`'s Population
footer; the composer rewrite handler re-POSTs to the originating skill's runner with the lever as steering
(see `card-rewrite.ts` / `CHAIN_HANDOFFS` self-handoff) → new card + Read in-thread → show the DELTA.
Its live verify triggers a REAL regeneration, so budget for a heavy browser loop. **PR-4 (desktop rail)
still needs owner scope sign-off before building.** Stack retarget still pending: when #109 → `milestone/the-room`,
retarget #111 → #113 → #115 onto `milestone/the-room`.

## ★ SESSION UPDATE (2026-07-03 late) — Task C SHIPPED + live ambient-audience audit

**Task C (clean composer) DONE → PR #113** (`feat/the-room-composer` off `feat/the-room-bloom`,
commit `0f2e33cc`, composer-only — no Room-body overlap). Bottom bar is now the v6 `✦ Make ▾ · input · ↑`:
skill pill → **verb chip** (Make/Test/Ask, terracotta ✦ spark, new `VERB_BY_TOOL` in `composer-controls.tsx`);
intent control removed (intent = audience `goal_intent`, dropped `intentOverride`); model tag removed
(`ModelTag` component + its unit test kept, just not rendered); `+` attach removed → **Test absorbs upload**
(drop zone reveals on INTENTIONAL Test entry — explicit pick or hook/script "Test full →" handoff — NOT the
bare default, so the empty home stays a clean topic composer); small evidence paperclip kept. Menu group-collapse
into Make/Test/Ask = **Phase 3** (chip collapses on its FACE only; SkillRows untouched); `mode='embedded'`/`onLaunch`
start-page seam = **deferred** (sister-session dependency). tsc 21 baseline, vitest 50 pass. Files:
`composer.tsx` + `composer-controls.tsx` + `__tests__/composer-controls.test.tsx`.

**★ Branch note for PR-2:** PR-2 also edits `composer.tsx` (thread `focusList`/`onStep` into `<AudiencePresence>`),
so **branch PR-2 off `feat/the-room-composer`** (inherits Task C's composer edits → no stacked-diff conflict).

**Live ambient-audience audit (Room open on a General hooks thread) vs the v6 prototype — owner flagged the
ambient audience "doesn't represent the prototype correctly yet." Concrete gaps found:**
- **People tab:** ✓ Bloom rises + flush-merges · ✓ named voices + serif quotes + `ask →`. **✗ NO header stepper
  `‹ Hook 1 of 3 ›` + `⤺ all 3` view-all** (header is just the serif score + concept) = **PR-2, the top gap.**
  (Terminology: the header is only TWO things — the stepper + the `⤺ all N` view-all link. `⤺ all N` opens the
  ranked list "How the room ranked your N hooks" → tap a row to re-focus the Room on it. "compare" is just the
  prototype's CODE name — `openCompare`/`renderCompareHead`/`renderCompareBody` — NOT a user-facing control.)
  ⚠ **avatar tonal coding is TOO SUBTLE** — sage `.ava.g` (stop) vs coral `.ava.r` (bounce) barely distinguishable
  on dark; bump to the prototype's `rgba(142,166,138,.16)`/`#a6bfa1` legibility (POLISH). ⚠ confirm the
  "▶ Replay how the room reacted" button + "+N more of your 10" footer render (not seen in first viewport).
- **Population tab:** ✓ serif "500 stay / 500 bounce" hero · ✓ 90-dot swarm + "1,000 modeled from your 10 · ▶ Play"
  · ✓ loved/bounced stats bar · ✓ WEAK-SPOT (bouncers + real words). **✗ NO "Rewrite to win back the N% who
  bounced →" CTA** = **PR-3.**
- **Verdict:** the Room is FAITHFUL on the Bloom shell + People voices + Population hero/swarm/stats/weak-spot;
  the two missing INTERACTIONS are exactly **PR-2 (stepper + `⤺ all N` view-all)** + **PR-3 (Rewrite)**, plus avatar-tone + Replay
  POLISH. Recommended order next session: **PR-2 → PR-3 → (avatar-tone + Replay polish) → PR-4 (scope-confirm).**

## 0. Setup (start here)
```bash
cd ~/virtuna-the-room
git switch feat/the-room-bloom          # PR-1 branch (has the rebuilt Room + the seam)
# dev server (gotchas: 768MB heap OOMs; the npx wrapper breaks dev — use the node bin + big heap):
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000 · already logged in as e2e-test@virtuna.local / e2e-test-password-2026
# THE SPEC (serve + compare side-by-side, drive it, it's the working spec):
cd docs/prototypes && python3 -m http.server 8899
#   mobile:  http://localhost:8899/the-room-prototype-v6.html   (Bloom — the Room body spec)
#   desktop: http://localhost:8899/the-room-desktop-v1.html     (persistent rail — PR-4)
```
Verify EVERY step live in a real browser (Playwright MCP; screenshots land in the worktree root as
`*.jpeg` when you pass a `filename` — Read them, then `rm`). Test a CALIBRATED audience too, not just
General. Keep `tsc` at the **21 `__tests__` baseline** + the matte guard green. The **auto-wip daemon
is live** in this worktree — commit deliberately, never force-push under it.

## 1. Branch / PR state (stacked)
- **PR #109** — the archetype SEAM. `feat/the-room-focus-archetypes` → `milestone/the-room`. **OPEN.**
  KEEP. It makes `AmbientFocus.personas` carry real registry archetypes → the named cast is real.
- **PR #111** — PR-1, the v6 Bloom Room body. `feat/the-room-bloom` → **`feat/the-room-focus-archetypes`**
  (stacked on the seam so the diff is just the Room body). **OPEN.** Commits `87785ef6` + `3c7ab746`.
  → When #109 merges into `milestone/the-room`, **retarget #111 to `milestone/the-room`** (`gh pr edit 111 --base milestone/the-room`).
- Continue PR-2+ **on `feat/the-room-bloom`** (or branch off it and stack again). Small PR per surface.

## 2. What PR-1 shipped (DONE — don't rebuild)
New `src/components/audience-lens/AmbientRoom.tsx` + rewired panel in `audience-presence.tsx`:
- **Bloom shell** — the panel is a `h-[72vh]` sheet that rises out of the presence band (translate-y +
  opacity via a `risen` state), 20px top radius, `border-b-0`, band squares its top → flush-merged.
  (72vh not 76vh so the top clears the app's ☰ sidebar toggle — a 76vh top collided with it.)
- **People tab** = named voices: tonal avatar (sage `rgba(142,166,138,.16)`/`#a6bfa1` for a stop;
  `--color-accent-soft`/`--color-accent-text` for a bounce), name, `ask →` (gated on a real registry
  enum → opens the REUSED `PersonaChatDrawer`), OWN verbatim serif quote. "▶ Replay" streams them in.
- **Population tab** = the v6 hero built PURELY from the real reactions: serif green "N would stay" /
  coral "N would bounce" → a 90-dot sample swarm (green stay / coral bounce, Play reveals it) →
  "1,000 modeled from your N" → a green/coral stats bar → the **WEAK SPOT** (coral-named bouncers +
  their real words). NOT `PopulationSwarm`'s analytics face.
- Dropped the in-room "Your asks" history (v6 reflects the CURRENT focus). `asks`/`onReask` stay in
  the `AudiencePresenceProps` contract (composer still passes them) but are no longer destructured.
- Presence test updated to the v6 IA (People ⇄ Population, serif score, weak-spot).

**Verified live**: General (persisted thread — Robin…Dev, 500/500, weak-spot, "Ask Dev" in-voice +
rehydrate) AND calibrated (Fitness Creators react on "protein myths" — 5 sage stops / 5 coral bounces).

## 3. REMAINING work (in priority order)

### PR-2 — Anchored-focus header: stepper `‹ N of M ›` + `⤺ compare` + re-target-in-place
The Room header today shows only the serif score + concept. The prototype's header (`renderDrillHead`
/ `renderCompareHead` / `renderCompareBody` in v6) is: a row with `‹ Hook 1 of 3 ›` stepper (left) +
`⤺ all 3` compare (right), THEN the serif score. Tapping ‹/› steps to the sibling card **in place**;
`⤺` opens a ranked-list compare view; tapping a compare row re-targets the Room on that card.

**This needs NEW plumbing the focus contract doesn't expose yet.** `useAmbientFocus` returns only the
resolved `focus` (one concept). To step, the presence needs the current batch's **sibling descriptors**
+ the **resolved focus id** + a **step callback**. The pieces already exist in the composer:
- `ambientDescriptors: AmbientCardDescriptor[]` (composer.tsx ~L1413) — the flat per-tool card list
  (each has `id`, `conceptText`, `fraction`, `scrollQuote`, `personas`). This IS the sibling list.
- `focusByTap(id)` (from `useAmbientFocus`) — already re-points focus by card id (sticky). This IS the
  step callback (call it with the prev/next sibling's id).
- The resolved focus's id is NOT currently on `AmbientFocus` (it carries concept/fraction/quote/personas
  but no id). **Add an `id?` to `AmbientFocus`** (in `ambient-presence-types.ts`) and set it in
  `use-ambient-focus.ts` `toFocus()` (from the descriptor's id) so the presence knows which sibling is
  current. Thread `descriptors` (as a `focusList`) + `onStep(id)` (= `focusByTap`) from composer →
  `AudiencePresence` → `AmbientRoom`. Compare = a local ranked view of `focusList` (sort by parsed
  stop-count); tapping a row calls `onStep(id)`.
- Files: `ambient-presence-types.ts` (add `id`), `use-ambient-focus.ts` (`toFocus` sets id +
  `AmbientCardDescriptor` already has id), `composer.tsx` (pass `focusList={ambientDescriptors}` +
  `onStep={focusByTap}` into `<AudiencePresence>`), `audience-presence.tsx` (forward to `AmbientRoom`),
  `AmbientRoom.tsx` (render the stepper header + compare view; markup = v6 `renderDrillHead`/`renderCompare*`).
- Honesty: the stepper only steps within the CURRENT batch's siblings; idle shows no stepper. Note the
  prototype shows a "kind" label ("Hook 1 of 3") — the descriptor doesn't carry a kind; either thread a
  `kindLabel` from the composer (it knows `activeTool`) or show a generic label.

### PR-3 — Rewrite lever on the Population weak-spot
The prototype's Population ends with a coral CTA "Rewrite to win back the N% who bounced →" that, on
tap, regenerates the concept steered by the Read's lever and shows the DELTA. The contract already
exists: `AudienceLensContent`'s `LensRewrite` prop (`endpoint`/`lever`/`platform`/`priorStopCount`/
`priorTotal`/`onRewrite`) + `RewriteCta`. The presence never wires it. Plumb a `rewrite` handler from
the composer (re-POST to the originating skill's own runner with the lever as steering → new card +
Read in-thread; see `card-rewrite.ts` / `CHAIN_HANDOFFS` self-handoff) → `AudiencePresence` →
`AmbientRoom`'s Population footer. Build the CTA + delta readout in `AmbientRoom` (mirror `RewriteCta`).

### PR-4 — Desktop persistent rail + `variant='thread'|'surface'` + user-default audience
**Confirm scope with owner before building the rail** (it's an architecture change). Spec =
`the-room-desktop-v1.html`: a two-pane `grid` (`1fr var(--rail)`) restructure of `HomePageLayout` /
composer — the audience is always on screen; idle shows the roster; focusing a card fills the rail;
`ask →` overlays a chat. Plus (contract seam 3, kickoff §5) `variant='thread' | 'surface'`: `surface`
= app-wide PEEK band + read-only panel (no composer field on non-thread pages) — keep the `<body>`
portal + `position:fixed` pattern. Plus a user-level default/last-used audience (`resolveUserAudience`
sibling to `resolveThreadAudience`) the switcher writes on every selection, for surfaces + new-thread seed.

### Task C — Clean composer (`✦ Make ▾ · input · ↑`) — SEPARATE, most-visible mismatch
Not part of Task B, but it's the biggest remaining visual gap on the main screen (the bottom bar still
shows `Hooks / 📎 / SIM-1 Flash`). Verb chip Make ▾ / Test / Ask (skills under Make), intent → audience
`goal_intent`, model tag removed, Test absorbs upload. Files: `composer.tsx` + `composer-controls.tsx`
(SKILLS SSOT; carries the popover-portal fix — don't regress it). Owner may want this prioritized over
PR-2/3/4 — ASK which order they want.

## 4. Key files (all real, verified this session)
- `src/components/audience-lens/AmbientRoom.tsx` — the Room body (People + Population). PR-1.
- `src/components/audience-lens/audience-presence.tsx` — peek band + switcher + the Bloom panel shell.
- `src/components/audience-lens/ambient-presence-types.ts` — `AmbientFocus` (add `id?` for PR-2).
- `src/components/app/home/use-ambient-focus.ts` — focus resolution; `focusByTap` = the step callback.
- `src/components/app/home/composer.tsx` — `ambientDescriptors` (~L1413, the sibling list), the
  `<AudiencePresence>` mount (~L1481), `askAudience` (react route).
- `src/components/audience-lens/PersonaChatDrawer.tsx` — the named in-voice chat (REUSE; works).
- `src/lib/audience/persona-names.ts` — `resolvePersonaName` / `personaNameMap` (name SSOT).
- `src/components/board/audience/audience-derive.ts` — `buildFlatPersonaNodes`, `FlatPersonaReaction`.
- `src/components/audience-lens/AudienceLensContent.tsx` — the OLD analytics Lens; still mounts in the
  video Reading (`reading/reading-panels.tsx`) — do NOT touch that path. `LensRewrite` lives here (PR-3).

## 5. Verify gotchas
- `npx vitest` prints fake PASS; use `node ./node_modules/vitest/vitest.mjs run <file>`.
- Vitest teardown spews `AbortError` noise (mounted fetches) — filter with `grep -viE AbortError`; read
  the `Test Files` / `Tests` summary lines.
- Screenshots: pass `filename` → they land in the WORKTREE ROOT (`*.jpeg`), Read them, then `rm` (they're
  gitignored but keep the tree clean).
- Design system: flat-warm charcoal — bg `#262624`, cream `#ece7de`, terracotta `#d97757`, 6% borders,
  Inter chrome + Newsreader serif for voice moments. The v6 prototype's `--good` sage `#8ea68a` is the
  sanctioned "stop/loved" green in the Room (matches the spec).
