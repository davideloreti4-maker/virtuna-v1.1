# Phase 1 Kickoff — "The Room, made real"

> Start-here doc for a fresh session building Phase 1 of The Room milestone.
> Worktree: `~/virtuna-the-room` (branch `milestone/the-room`), synced to `origin/main`
> as of 2026-07-03 (includes the composer popover-portal fix, PR #104 `a44ee74d`).
> Full design context = `docs/THE-ROOM-HANDOFF.md`. **The design is LOCKED (Bloom).**

---

## 0. The spec (design is done — build to these)

Serve over http and drive them; they are the working spec, not throwaway:
```bash
cd ~/virtuna-the-room/docs/prototypes && python3 -m http.server 8899
# mobile:  http://localhost:8899/the-room-prototype-v6.html
# desktop: http://localhost:8899/the-room-desktop-v1.html
```
- **Mobile = Bloom**: the Room grows up out of the always-present audience band into one connected object; opens to ~77%.
- **Desktop = persistent audience rail**: the audience is always on screen; focusing a card fills the rail.
- **People tab** = pure voices (named people, serif quotes, `ask →`, Replay streams reactions in one-by-one). No stats/buttons.
- **Population tab** = swarm hero (500 stay / 333 bounce + 1,000-dot viz) → stats bar → **weak-spot** (who bounced + their exact words) → **Rewrite** lever.
- **Thread** = compact one-line cards (rank + score pill + title); batch headers `3 HOOKS · best 7/10`. Detail lives in the Room.
- **Composer** = `✦ Make ▾ · input · ↑`. Verbs Make/Test/Ask; intent→audience goal; model tag gone; Test absorbs upload.

## 1. Goal

Turn the buried analytics panel into a **living, always-present, interrogable Room**, and make the audience **real named people** (not registry archetype enums). Ship the moat + the reframe together.

## 2. Build order (named-people FIRST — it's the moat and the riskiest)

**Task A — Named-people plumbing** (do first; de-risks everything)
- Today the persona chat + reactions are grounded on the registry `archetype` ENUM, not the audience's real named personas. Bridge/replace so Maya/Jordan/… are the real calibrated personas.
- Files: `src/components/audience-lens/PersonaChatDrawer.tsx` (grounding = `personaGrounding {archetype, reactionToConcept, conceptText}` → `/api/tools/chat`), `src/lib/engine/wave3/persona-registry.ts` (`ARCHETYPES` enum), `src/lib/audience/resolve-thread-audience.ts` + `audience-repo.ts` (persona source), and the skill routes that return `audienceArchetype`/`scrollQuote` (`src/app/api/tools/hooks/route.ts` + siblings).

**Task B — Living presence + Room rebuild**
- Rebuild `src/components/audience-lens/audience-presence.tsx` into the always-visible living presence (mobile: Bloom from presence; desktop: persistent rail). The switcher already portals to `<body>` — mirror that pattern.
- Reuse existing lens pieces: `AudienceLensContent.tsx` (Panel·10 ⇄ Population·1,000, ReplayController, PersonaChatDrawer mount, Rewrite CTA), `PopulationSwarm.tsx` (honest 1,000 from 10).
- Apply the v6 IA: people=voices; population=swarm hero + stats bar + weak-spot + Rewrite. Replace the implicit scroll-focus with explicit **anchored focus** (per-card, stepper, re-target swaps in place).

**Task C — Clean composer**
- `src/components/app/home/composer.tsx` (~2000 ln host) + `composer-controls.tsx` (SKILLS SSOT; now carries the popover-portal fix). Verb chip (Make ▾ / Test / Ask), audience lives in the presence not a control, intent = audience `goal_intent`, remove the model tag, Test = upload a video.

## 3. Verify (every task, live in the real app)
```bash
# dev server (gotchas: 768MB heap OOMs; npx wrapper breaks dev — use node bin + big heap)
cd ~/virtuna-the-room && NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000 · login e2e-test@virtuna.local / e2e-test-password-2026
```
- Do a **real browser pass** (Playwright/next build) — vitest can't catch Next client/server bundle leaks.
- Keep guards green: `reading/__tests__/reskin-matte.test.ts` (no coral/glass), tsc clean.
- Small PR per task.

## 4. Notes
- Audience is per-thread pinned (`thread.active_audience_id`) and the engine already reads it — the plumbing works; the problems were UX/discoverability + the archetype-not-named seam.
- `.env.local` already copied into this worktree (Supabase + engine keys).
- Design system: flat-warm charcoal — bg `#262624`, cream `#ece7de`, terracotta `#d97757` (near-zero dosage), 6% borders, 12px radius, Inter chrome + Newsreader serif for voice moments. SSOT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.

## 5. Cross-session contract sign-off (2026-07-03)
The sister session (`~/virtuna-surfaces`, `milestone/surfaces`) owns everything besides the thread and composes The Room's ambient audience onto every surface. Shared SSOT = `~/virtuna-surfaces/docs/THE-CONTRACT.md` (4 seams; The Room owns the real components, Surfaces stubs → grafts). **The Room signed off:**

- **Awareness — Seam 3 presence app-wide:** Task B must build `audience-presence.tsx` with `variant='thread' | 'surface'`, not thread-only. `surface` = app-wide PEEK band + read-only panel (no composer field to route asks into on non-thread pages) — that's the one design delta; keep the `<body>`-portal + `position:fixed` pattern.
- **Awareness — Seam 4 embedded composer:** Task C composer must expose `mode='thread' | 'embedded'` + `onLaunch(input, verb, audience)`. `embedded` = start page, no thread yet → on submit, create thread w/ audience+seed then route `/thread/:id` (reuse the existing Board-lifted create→navigate loop).
- **Item 1 (Outcome loop) — AGREE split.** Surface (account connect, paste-URL, receipts, accuracy-rising) = Surfaces; reconcile → recalibrate-the-twin = Room/engine. Condition: predicted-vs-actual delta + the write-back to the calibration asset are engine-side (honest, consistent w/ the sim). Build-last — don't design it twice.
- **Item 2 (audience outside a thread) — AGREE.** New small Room task: add a **user-level default/last-used audience** the switcher writes on every selection; `variant='surface'` + new-thread creation seed from it; `thread.active_audience_id` stays SSOT once inside a thread (`resolveThreadAudience` unchanged, add a `resolveUserAudience` sibling for surfaces).
- **Item 3 (card number) — CONFIRM ONE.** `CardReaction.stop` = single blended number. The Room owns the shared card; renders ONE. Craft is audience-agnostic in the engine today, so a two-signal card face would imply a per-audience distinction we don't compute — one number is the more honest face. The craft+audience-fit breakdown lives inside the Room drill, not on the card.

## 6. Task A DONE + findings (2026-07-03)
Named-people plumbing shipped on `feat/the-room-named-people` (commit `9aafd455`). New SSOT `src/lib/audience/persona-names.ts` (stable archetype→name map + `resolvePersonaName`/`personaNameMap`); `PersonaNode.name` threaded additively; the persona chat now displays + **speaks AS** the named person (verified live: the tough_crowd answered "I'm Dev…" via the real authed `/api/tools/chat`). tsc clean (no new), vitest green (+persona-names, chat-runner, lens, matte guard). Every non-Room surface stays byte-identical (`.label` untouched).

**★ Finding for Task B / the focus payload (blocks the ambient named list):** the "Ask them why →" named list only lights up where reactions carry a **real registry archetype** (Simulate/react personas block, video Reading). The **ambient presence focus** feeds `cardScrollQuoteReactions(fraction, scrollQuote)` with NO `leadArchetype`, so all 10 personas are positional `viewer_N` placeholders → `chatList` is gated OFF and names fall back to `.label`. To make the ambient Room a true named-people cast (the prototype's People tab), the **AmbientFocus / skill card blocks must carry per-persona registry archetypes** (at minimum the lead), not just a fraction + one lead quote. That's an engine/skill-route seam (attach `audienceArchetype` enums to the card's per-persona reactions) + a focus-payload change — do it in Task B (the anchored-focus Room rebuild), not Task A.
