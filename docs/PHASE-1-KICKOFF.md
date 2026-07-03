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
