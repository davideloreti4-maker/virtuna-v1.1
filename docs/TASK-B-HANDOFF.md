# Task B Handoff — The Room living presence + Room rebuild

> **Written 2026-07-03** at the end of the Task A session, to hand off into a fresh context.
> Worktree `~/virtuna-the-room`, branch `milestone/the-room` (tip includes Task A via PR #107 squash `52512dd8`).
> **Read order:** this doc → `docs/PHASE-1-KICKOFF.md` (§0 spec, §2 build order, §5 contract, §6 Task-A finding) → `docs/THE-ROOM-HANDOFF.md` (full design).
> **The design is LOCKED (Bloom). Build to the prototypes — don't re-derive.**

---

## 0. Where we are

- **Phase 1 · Task A (named-people) = DONE + merged** into `milestone/the-room` (PR #107, squash `52512dd8`). Verified: tsc no-new, vitest green, live authed chat answered *"I'm Dev…"* in-voice.
- **Next = Task B** (this doc). Then **Task C** (clean composer).
- The named-people SSOT now exists: `src/lib/audience/persona-names.ts` (`resolvePersonaName`, `personaNameMap`, stable archetype→name map). `PersonaNode.name` is threaded; the persona chat displays + speaks as the named person; `AudienceLensContent` accepts `personaNameOverrides`; `audience-presence` already builds + passes that map.

## 1. Task B goal

Rebuild `src/components/audience-lens/audience-presence.tsx` from the buried peek/panel into the **always-visible living presence + the Room drill**, per the v6 prototypes:
- **Mobile = Bloom:** the Room grows up out of the always-present audience band into one connected, flush-merged object; opens ~77%.
- **Desktop = persistent right rail:** audience always on screen; focusing a card fills the rail; `ask →` opens a chat overlay.
- **People tab = pure voices:** named people (now real — Task A), serif quotes, `ask →`, Replay streams reactions in one-by-one. No stats/buttons.
- **Population tab:** swarm hero (e.g. 500 stay / 333 bounce + 1,000-dot viz) → stats bar → **weak-spot** (who bounced + their exact words) → **Rewrite** lever.
- **Anchored focus** replaces the implicit scroll-spy: per-card door, header names the focus with a `‹ 2 of 3 ›` stepper + `⤺ compare`, **re-target swaps in place (never stacks)**, badge follows the newest batch only, idle = honest "N people ready" (never a faked reaction).

Serve the spec: `cd docs/prototypes && python3 -m http.server 8899` →
`the-room-prototype-v6.html` (mobile) · `the-room-desktop-v1.html` (desktop).

## 2. ★ CRITICAL — the Task-A finding that Task B must resolve (kickoff §6)

The named "Ask them why" **list + the People-tab voices only render where reactions carry a REAL registry archetype** (`ARCHETYPES` enum). The ambient presence today feeds `cardScrollQuoteReactions(focus.fraction, focus.scrollQuote)` with **no `leadArchetype`**, so all 10 personas are positional `viewer_N` placeholders → the chat list is gated OFF and names fall back to labels. **The People tab cannot be a real named cast until the focus carries per-persona archetypes.**

**To fix (engine/skill-route + focus-payload seam):**
- The skill card blocks (hooks/ideas/script/simulate/react) already run the sim during generation — the per-persona `{archetype, verdict, quote}` exists (see `PersonasBlock` / `MultiAudienceReadBlock`). The lightweight card carries only a `fraction` + one lead `scrollQuote`.
- Make the **AmbientFocus payload carry the per-persona reactions** (at minimum the lead archetype; ideally the full 10 `{archetype, verdict, quote}` so People-tab voices are real), then pass real `leadArchetype`/`flatPersonas` into the presence instead of the placeholder expansion.
- Files: `src/components/audience-lens/flat-card-reactions.ts` (accepts `leadArchetype`), `src/components/audience-lens/ambient-presence-types.ts` (`AmbientFocus`), the composer host that builds focus (`src/components/app/home/composer.tsx` — `ambientFocus`/`focusByTap`), and the skill card blocks in `src/components/thread/*-card-block.tsx` that own the per-card reaction data.
- The `personaNameOverrides` wiring is already in place — once real archetypes flow, names light up automatically.

## 3. Cross-session contract obligations (kickoff §5 — Surfaces session)

Both were signed off by The Room; Task B must honor them:
- **Seam 3 — presence mountable app-wide:** build `audience-presence.tsx` with `variant='thread' | 'surface'` (NOT thread-only). `surface` = app-wide PEEK band + read-only panel (no composer field on non-thread pages → no ask input there). Keep the `<body>`-portal + `position:fixed` pattern.
- **Item 2 — user-level default audience** (small, Room-owned, can be its own task): add a user-level last-used audience the switcher writes on every selection; `variant='surface'` + new-thread creation seed from it; `thread.active_audience_id` stays SSOT once inside a thread (`resolveThreadAudience` unchanged; add a `resolveUserAudience` sibling). Shared contract SSOT: `~/virtuna-surfaces/docs/THE-CONTRACT.md`.

## 4. Reuse (don't rebuild — ~70% exists)

- `AudienceLensContent.tsx` — the drill body (Read header, Panel·10 ⇄ Population·1,000, ReplayController, ClusterView, "Ask them why" list, Rewrite CTA, mounts PersonaChatDrawer). Now accepts `personaNameOverrides`.
- `PopulationSwarm.tsx` (honest 1,000-from-10), `ReplayController`, `ClusterView`, `lens-derive.ts`, `use-lens-scale.ts`.
- `PersonaChatDrawer.tsx` — real streaming persona chat, now named (Task A).
- Switcher already portals to `<body>` (mirror for the surface variant).

## 5. Verify (every task — real app, not just vitest)

```bash
# dev server (gotchas: 768MB heap OOMs; npx wrapper breaks dev — node bin + big heap)
cd ~/virtuna-the-room && NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000 · login e2e-test@virtuna.local / e2e-test-password-2026
```
- Vitest via the node bin ONLY (repo quirk): `node ./node_modules/vitest/vitest.mjs run <file>` — `npm test`/`npx vitest` print fake PASS(0)/FAIL(0).
- Real browser pass (Playwright MCP or `next build`) — vitest can't catch Next client/server bundle leaks. `file://` blocked → serve prototypes over `python3 -m http.server`.
- Keep guards green: `src/components/reading/__tests__/reskin-matte.test.ts` (no coral/glass), tsc clean (baseline = 21 pre-existing `__tests__` errors — count must not grow).
- Small PR per task, base `milestone/the-room`. Auto-push hook is on (commits push automatically).
- ⚠️ An **auto-wip daemon is live in this worktree** — it commits stray WIP to `milestone/the-room` (`chore(auto-wip): …`). Commit deliberately per task; don't be surprised by daemon commits between yours.

## 6. Design system

Flat-warm charcoal: bg `#262624`, cream `#ece7de` (never `#fff`), terracotta accent `#d97757` (near-zero dosage), 6% borders (hover 10%), 12px card radius, Inter chrome + Newsreader serif for voice moments ONLY. Matte — no glass/glow. SSOT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
