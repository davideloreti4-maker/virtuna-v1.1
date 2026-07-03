# The Surfaces — Milestone Handoff

> **Created 2026-07-03** to hand off into a fresh session working in this worktree
> (`~/virtuna-surfaces`, branch `milestone/surfaces`). Companion to `docs/THE-CONTRACT.md`.
> **Status: scope + spine LOCKED; surface pixels open to refinement while building.**

---

## 0. TL;DR — what this milestone is

**Everything besides the thread.** A sister milestone to **The Room** (`~/virtuna-the-room`, which owns the
thread / ambient audience / skills / engine). This milestone builds the surfaces *around* the thread and spreads
the ambient audience across the whole app.

**The one-liner:** *Take Stanley's packaging, make it predictive, and put the audience in every room — not just the thread.*

**Full vision + competitive teardown:** artifact "Juno — Winning the Surface"
`https://claude.ai/code/artifact/f39f287c-ad05-4c5b-81c9-b66c76f1018b`

**Reference — The Room** (the thread atom these surfaces compose; match its card / dock / room visual language so
the two halves feel like one product): handoff `~/virtuna-the-room/docs/THE-ROOM-HANDOFF.md` ·
prototype `https://claude.ai/code/artifact/bc2e21f1-0e10-4ab1-ba7a-2a9c51e82e42` ·
vision `https://claude.ai/code/artifact/a0dd0372-ab89-4f93-9eb3-d6e93527e3b0`

---

## 1. Scope (LOCKED)

| This milestone (Surfaces) | The Room (other worktree) |
|---|---|
| Start page · Feed · Calendar · Library · Account · the post-publish loop · **audience/twin management pages** · onboarding/first-run · pricing · mobile/PWA · GTM | The thread/composer · the ambient audience *in-thread* · the Read verdict · persona chat · the rewrite loop · **all skills** · the backend engine |
| **The ambient audience as it appears on all those surfaces** (composing The Room's atom) | Making the simulation audience-specific |

Do **not** build the thread, skills, or engine here. Import The Room's shared components (per `THE-CONTRACT.md`).

---

## 2. The spine (LOCKED) — the audience in *every* room

The moat isn't a thread feature. Put the ambient audience on **every** surface and it becomes the product's operating
logic — uncopyable, because Stanley/Sandcastles have no audience to make ambient.

- A **global audience presence (dock)** on every screen; each surface becomes a room the audience reacts in.
- **Discipline:** presence everywhere, **live reaction only where there's a real stimulus** — no faked depth, calm where nothing's being tested.
- The line **"pre-tested on your audience"** rides on every card/tile/slot/briefing item, not just thread cards.
- Speak **Make · Test · Ask** (not 13 skills); **named people**; plain English (no "SIM"); intent rides on the audience (no Grow/Sell toggle here).

---

## 3. Build sequence — surfaces first, ambient-ready, by dependence

> **Phase 0 — PROTOTYPE FIRST (do this before any real code).** Mirror The Room's prototype-as-spec: build a
> throwaway clickable HTML prototype of the **start page** at `docs/prototypes/start-page-prototype.html` —
> **mobile-first** (phone frame like The Room's), flat-warm charcoal, rendering the contract's stubbed
> `CardReaction`/`Read` shapes and matching The Room's card/dock/room visual language. Where a fork exists
> (e.g. one blended number vs craft+audience-fit split), show BOTH via a toggle for owner pick (like The Room's
> Bloom-vs-Floating). Get owner sign-off, THEN execute steps 1–6 below. No dev server / npm needed for the
> prototype — view via `python3 -m http.server` (file:// is blocked in the MCP browser; keep `<meta charset="utf-8">`).

1. **Prove the contract** *(first move)* — a thin stubbed dock + a stubbed reaction-card reading a mock `Read`/`CardReaction`
   payload (`THE-CONTRACT.md` §3). De-risks everything; every surface then designs against a real (if fake) interface.
2. **The start page — the flagship** *(high-ambient)* — the briefing shell + **embedded composer** (`mode='embedded'`) + the
   launch-into-thread handoff + first-run/empty states. Stubbed reaction content in reserved slots. Proves "ambient everywhere +
   a real daily habit" on one screen; the clearest Stanley-beat. (Replaces today's cold composer home at `/home`.)
3. **Calendar + pillars** *(low-ambient)* — pillars, planned month, drag-to-slot; predicted-score-per-slot is the reserved slot.
   Closes Stanley's gap and the pricing-page promise-gap ("Content calendar suggestions" is sold with no surface behind it).
4. **The post-publish loop** *(coordinate engine)* — account connect → paste-URL → receipts ("we said 7, you got 7") → accuracy-rising.
   Surface is ours; recalibration is The Room's (reconciliation §6.1 of the contract). Backend exists, unwired (see §5).
5. **Feed & Library — ambient echoes** *(frame + slot)* — tile inline-read + saved-card echoes, against the shared card.
6. **Graft the atom, everywhere** *(when The Room ships)* — swap every stubbed card/dock for the real shared components in one coordinated pass.

Process: lean, artifact-as-spec, **verify each surface live in-browser**, small PR per surface. No heavy GSD ceremony.

---

## 4. Current-state audit (verified in code, main, 2026-07-03)

- **Home = a cold composer greeting** ("Ready to simulate your audience?") + 3 static starter chips — **no proactive/briefing content.** → the start page fixes this.
- **No calendar surface exists** — yet `pricing-section.tsx` sells "Content calendar suggestions." Promise-gap → our build.
- **The post-publish loop backend is BUILT but UNWIRED:** `POST /api/outcomes/signature`, `src/lib/flywheel/*` (reconcile,
  outcome-repo, realized-signature), tables `outcomes`/`outcome_signatures`/`reconciliations`, and hook
  `src/hooks/queries/use-outcome-signature.ts` — **the hook has ZERO importers.** No "paste your post URL" affordance anywhere.
  → wiring the surface is a Surfaces job (recalibration coordinates with The Room).
- **Already real (build on / echo):** `/feed` (watched + trending + outliers + Hooks vault), `/library` (saved cards echo),
  `/audience` (manager page + the ambient lens `audience-presence.tsx`), `/competitors`, `/referrals`, Grow/Sell intent plumbed.
- Nav today (`src/components/sidebar/Sidebar.tsx`): New Thread→`/home` · Audience · Library · Feed · Competitors · Referrals · Account→`/settings`. `/discover`→redirect `/feed`; `/saved`→redirect `/library`.
- **Not ours (The Room's):** the Read screen (`analyze/[id]/result-card.tsx`, ~70% placeholder) and all in-thread skills.

---

## 5. Reuse map — The Room's code + shared seams (don't rebuild)

- **Shared components (import, per `THE-CONTRACT.md`):** `src/components/audience-lens/` — `AudienceLensContent.tsx`,
  `PersonaChatDrawer.tsx`, `PopulationSwarm.tsx`, `audience-presence.tsx` (PEEK + PANEL; **switcher portaled to `<body>`** — mirror
  for our app-wide dock), `ambient-presence-types.ts`.
- **Composer:** `src/components/app/home/composer.tsx` + `composer-controls.tsx` (SKILLS SSOT: `ToolId`, `SKILLS`, `isSkillVisible`).
  The start page needs a **`mode='embedded'`** entry (contract Seam 4) — coordinate with The Room's composer rework.
- **Audience resolution:** `src/lib/audience/resolve-thread-audience.ts` (reads `thread.active_audience_id`, NULL=General),
  `resolve-tier.ts`, `intent-lens.ts`. **Reconciliation #2:** non-thread surfaces need a user-level active audience.
- **Feed / Library / Audience surfaces** already exist — extend, don't recreate.

---

## 6. Open decisions (from the contract + vision forks)

- **★ Reconciliations with The Room** (`THE-CONTRACT.md` §6): outcome-loop ownership · user-level active audience · card one-number-vs-two.
- **Composer routing:** start page becomes the default landing; today `/home` IS the composer. Coordinate the exact routing (start = home; typing / tapping an item opens the thread).
- **Asset export & native mobile:** match Stanley on both, one, or neither? *Lean: minimal export only; PWA + web push over native.*
- **Shareable theater** ("profile a chat → simulate the reply") as a growth surface now, or in-app moment? *Lean: distinct GTM bet, scope later.*

---

## 7. Setup for the fresh session (start here)

```bash
cd ~/virtuna-surfaces                     # this worktree (branch milestone/surfaces)
git config core.hooksPath .githooks       # enable auto-push
npm install                               # worktrees do NOT share node_modules
cp ~/virtuna-refine/.env.local .env.local # env is gitignored — copy from a sibling (Supabase + engine keys)

# Dev server — GOTCHAS: 768MB heap OOMs; the npx wrapper breaks dev. Use the node bin + bigger heap.
# Pick a port NOT used by siblings (the-room=3000, feed=3200, refine=3300):
PORT=3400 NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3400
```

- **Test user:** `e2e-test@virtuna.local` / `e2e-test-password-2026` (log in at `/login`; lands `/home`).
- **Browser verify:** Playwright MCP; `file://` blocked (serve HTML over `python3 -m http.server`); screenshots save to cwd — clean up.
- **Design system:** flat-warm charcoal — bg `#262624`, cream `#ece7de`, terracotta `#d97757` (near-zero dosage), 6% borders,
  12px card radius, Inter chrome + Newsreader serif for voice moments. SSOT `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
- **Naming (provisional):** Numen Machines = company · **Juno** = this app · Neura = the sim model · The Room = the thread surface. Codebase still Numen/virtuna.

---

## 8. First-session checklist

- [ ] `cd ~/virtuna-surfaces`, `npm install`, copy `.env.local`, start dev on **:3400** (§7).
- [ ] Read `docs/THE-CONTRACT.md` + this file + the vision artifact.
- [ ] Confirm the 3 reconciliations with The Room session (§6).
- [ ] **Step 1:** stub the contract (mock dock + reaction-card + `Read` payload).
- [ ] **Step 2:** build the start-page shell against it — briefing sections + embedded composer + launch-into-thread handoff + first-run states. Verify live in-browser. Small PR.
