# The Room — Milestone Handoff

> **Created 2026-07-03** at the end of a long design session, to hand off into a fresh
> context working in this worktree (`~/virtuna-the-room`, branch `milestone/the-room`).
> **Status: design-shaping, NOT locked.** The prototype below is *directional* — the flow
> and model are largely agreed; the exact pixels/interactions are still open to refinement
> during the build. Do **not** treat the sketch as a final spec to copy verbatim.

---

## 0. TL;DR — what this milestone is

Rebuild Numen's **ambient audience** into "**The Room**": the moat surface where the
creator's synthetic audience reacts to everything they make, and they can interrogate any
member. Today it's built but presented as a buried analytics panel; this milestone makes it
a **living, always-present, interrogable room** — the felt moat.

**The one-liner:** *Numen is a group chat with your audience — you post before the world
does, they react instantly, and you can ask any of them why.*

---

## 1. The two artifacts (the real spec)

Both are self-contained Claude Artifacts (charcoal/terracotta, Numen's own system):

- **Vision doc** — the why/what/moat/object-model/flywheel:
  `https://claude.ai/code/artifact/a0dd0372-ab89-4f93-9eb3-d6e93527e3b0`
- **Clickable prototype (v5, current)** — the how, playable end-to-end:
  `https://claude.ai/code/artifact/bc2e21f1-0e10-4ab1-ba7a-2a9c51e82e42`

The prototype source (throwaway, for reference only — NOT to ship) is at:
`<session scratchpad>/numen-room-prototype.html` (session-specific temp; the artifact URL is
the durable copy). To view it standalone: serve over http (file:// is blocked in the MCP
browser) and it needs the `<meta charset="utf-8">` it already has.

---

## 2. The model (agreed)

**Object model — five nouns, everything is these:**
- **Your Audience** — a living model of the creator's *real* followers (calibration = the moat asset).
- **A Person** — a *named* character (Maya, Jordan…), ~10–12 representing the segments. They recur; you get to know them.
- **Content** — anything tested: a hook, idea, script, real video, or a raw thought.
- **A Reaction** — how one Person responds: verdict + moment + *what they'd say, in voice*.
- **The Read** — the room's aggregate: headline metric, who split which way, the weak spot, the fix.

**The loop everything reduces to:** Show → React → Read → Interrogate → Improve → **(post) → Learn.**
Steps 1–5 are the session; step 6 (ingest real outcomes → sharpen the model) is the compounding moat.

**Three interaction tiers:**
1. **Glance** (auto, free): every generated card wears the room's verdict inline (already ~built — the sim runs during generation).
2. **Focus** (the presence): an always-visible living audience band reflects what's in focus.
3. **Drill** (on tap): the Room — named-people feed, persona chat, population, rewrite.

---

## 3. LOCKED design decisions (confirmed by owner this session)

1. **Auto-scoring, inline.** Every card shows its reaction chip; the room is omnipresent, not a separate box you send to.
2. **Anchored focus.** The Room always points at exactly one card; you always see which; it only moves when you tap. Mechanics: per-card doors; a header that names the focus with a `‹ 2 of 3 ›` stepper + `⤺ compare`; **re-target swaps in place (never stacks)**; the roll-up **badge follows the newest batch only**; older batches stay permanent doors; idle = honest "N people ready" (never a faked reaction).
3. **Named people over generic archetypes** — the #1 upgrade. Chat/reactions must be *Maya/Jordan* (from the audience's real personas), not the registry archetype enum. Turns a demo into a relationship.
4. **Living audience presence, always visible** (animated constellation + name/switch + pulse), sitting between thread and composer. This is the moat on screen at all times. (I briefly regressed this into a chip — owner corrected; it must stay a present, alive entity.)
5. **Composer stripped clean** = `✦ Make ▾ · input · ↑`. Control fates:
   - Skill pill → the **verb chip** (Make ▾ / Test / Ask); skills are sub-items under Make.
   - `+` upload → absorbed by **Test** (Test = upload a video) + a small in-input paperclip for evidence.
   - **Intent (Grow/Sell) → a property of the audience's goal**, NOT a separate control (data already models `goal_intent`).
   - Model tag (SIM-1 …) → **removed** (read-only, retiring jargon, verb implies depth).
6. **Population separated from the persona feed.** A scale toggle **The people ⇄ Population·1,000** that *swaps* the view — not stacked/clustered. Each with its own **motion** (Replay the persona reactions / Play the 1,000-swarm). The living motion is a deliberate wow; keep it.
7. **The Room is the stage; skills are how you put things on it.** IA collapses ~13 skills → **three verbs: Make · Test · Ask.**
8. **Plain-English language** (brand direction): retire "SIM" jargon; "personas" → people; keep the honesty spine (never fabricate, show the basis, honest about confidence).

---

## 4. OPEN decisions (resolve early in the build)

- **★ Room form: Bloom vs Floating — DECIDED: Bloom (2026-07-03).** Floating removed entirely. The Room is full-width and grows up out of the presence band into one connected, flush-merged object. On **desktop** the model shifts to a **persistent audience rail** (audience always on screen; focusing a card fills the rail) — bloom is a mobile idiom, a side panel is the desktop idiom. See prototypes below.
- **Prototypes are now local, interactive, and the working spec** (in `docs/prototypes/`, served over `python3 -m http.server`):
  - `the-room-prototype-v6.html` — **current mobile spec.** Bloom-only. People tab = pure voices (serif quotes, ask→, Replay streams reactions in one-by-one). Population tab = swarm hero + stats bar + weak-spot (who bounced + why) + Rewrite. Thread = compact one-line cards (rank + score pill), batch headers ("3 HOOKS · best 7/10"). Room opens to ~77%.
  - `the-room-desktop-v1.html` — **desktop spec.** Persistent right rail; idle shows the roster; focusing a card fills the rail with the Room; ask→ opens a chat overlay.
  - `the-room-prototype-v5.html` — pre-refinement Bloom (reference only).
- **"Reactions arrive" motion depth** — proposed: streamed-in one-by-one for the flagship **Test**; badge count elsewhere. Not finalized.
- **Fuller Read for a real-video Test** (theme #4, deeper) — a Test should get a *richer Read card* in the thread (inline retention curve), not a one-line chip like a hook. First cut only exists.
- **Scale/representation** — feed shows ~6 of 10 people ("+4 more"); Population is honest "1,000 modeled from your 10" (NOT 1,000 model calls). Confirm the copy/representation.
- **Greeting → thread transition** polish (currently abrupt).
- **General reminder:** sketches are directional; expect refinement while building.

---

## 5. Build phases (proposed)

- **Phase 1 — "The Room, made real"** (moat + reframe together):
  - Named people plumbing (persona chat + reactions grounded on the audience's real named personas, not archetype enum).
  - Rebuild the audience presence → always-visible living presence + the Room drill (people-first, scale toggle, motion). Reuse existing lens pieces.
  - Clean composer (verb chip + audience-in-presence + input; intent→audience; model gone; Test absorbs upload).
- **Phase 2 — Reactions-arrive dopamine** (badge follows newest; the "10 new" pull; presence liveness on generate).
- **Phase 3 — Three-verb IA finalize** (Make/Test/Ask; skill-menu collapse; the fuller Test Read card).
- **Phase 4 — Outcome loop** (account connect → predicted-vs-actual → model sharpens). Heaviest; design-now, build-last. THE compounding moat.

Process: lean, artifact-as-spec, verify each phase live in-browser, small PR per phase. No heavy GSD ceremony required (GSD is retired/lean here); `/gsd-new-milestone` is optional if you want scaffolding.

---

## 6. Codebase audit — what ALREADY exists (don't re-derive)

The engine of the moat is ~70% built. Key files:

**Audience lens (the Room's guts) — `src/components/audience-lens/`:**
- `AudienceLensContent.tsx` (454 ln) — the deep read: Read header, **Panel·10 ⇄ Population·1,000** scale toggle, ReplayController, ClusterView, per-persona "Ask them why →" list, sticky **Rewrite** CTA (with before/after delta), mounts the persona chat drawer. Mounts in BOTH `audience-presence.tsx` and `reading/reading-panels.tsx`.
- `PersonaChatDrawer.tsx` (304 ln) — **real, streaming, in-voice persona chat**, grounded via `personaGrounding {archetype, reactionToConcept, conceptText}` → `/api/tools/chat`, rehydrates prior turns, retry. **SEAM: grounded on registry `archetype` enum, not named personas** — this is the named-people upgrade target.
- `PopulationSwarm.tsx` (282 ln) — honest 1,000-dot swarm *instantiated from the 10 real archetypes* (NOT 1,000 calls); deterministic (mulberry32); batched SVG.
- Others: `AudienceLens.tsx` (sheet wrapper), `LensTrigger.tsx`, `use-lens-scale.ts`, `lens-derive.ts`, `card-rewrite.ts`, `flat-card-reactions.ts`, `ReplayController`, `ClusterView`, `ambient-presence-types.ts`.

**The current ambient presence — `src/components/audience-lens/audience-presence.tsx` (~495 ln):**
- Two states: PEEK band (docked above composer) + PANEL (expands upward). Owns identity + switcher. The **switcher is portaled to `<body>`** (fixed, anchored above trigger) to escape the composer's `overflow-hidden` — mirror this pattern. This file is the redesign target for the "living presence."

**Composer — `src/components/app/home/`:**
- `composer.tsx` (~2000 ln) — hosts everything. Audience state: `audiences` (from `GET /api/audiences`), `selectedAudienceId`, `handleSelectAudience` (optimistic + **PATCHes `thread.active_audience_id`**), `audienceOpen`, `ambientFocus` + scroll-spy (`data-ambient-card`, `focusByTap`) — NOTE: this implicit scroll-focus is what we're REPLACING with explicit anchored focus. The composer dock = `composerDock` (~line 1977) with the `!audienceOpen && overflow-hidden` clip.
- `composer-controls.tsx` (~730 ln) — the control row + SKILLS SSOT (`ToolId`, `SKILLS`, `MODEL_LABEL`, `SkillRows`, `ModelTag`, `isSkillVisible`). The skill pill / intent / model / attach live here. **This is where the composer rethink lands.** ⚠️ Contains the popover-portal fix (see §7).

**Server / audience resolution:**
- `src/app/api/tools/hooks/route.ts` (+ sibling skill routes) — resolves audience via `resolveThreadAudience(supabase, openThread)` (reads `thread.active_audience_id`; NULL = General). The **sim runs during generation** → cards come back with `audienceArchetype`, `scrollQuote`, stop-fraction. So per-card reactions are ~free.
- `src/lib/audience/` — `resolve-thread-audience.ts`, `audience-repo.ts`, `resolve-tier.ts` (Directional/Validated), `intent-lens.ts` (`goalIntentToLens`), `audience-types.ts`.
- Persona registry: `src/lib/engine/wave3/persona-registry.ts` (`ARCHETYPES`) — the enum the chat currently validates against (the named-people upgrade must bridge audience personas → this or replace it).

**Key architectural note:** audience is **per-thread pinned** (`thread.active_audience_id`), and the switcher DOES persist to it and the engine DOES read it. So audience selection *works* — the problems were UX/discoverability + the archetype-not-named seam, not broken plumbing.

---

## 7. ⚠️ Loose ends from this session — DO NOT LOSE

1. **Popover top-clip fix — ✅ RESOLVED: merged to main as PR #104 (`a44ee74d`, `composer-controls.tsx` +61/−12) and now merged into `milestone/the-room` (2026-07-03). No longer a loose end.** (Original note below kept for context.) What it does: the skill-menu popover was clipped by the composer dock's `overflow-hidden`; reworked the shared `Popover` to **portal to `<body>` + `position:fixed` anchored above its trigger** (mirrors `audience-presence.tsx`), and excluded the portaled menu from the outside-click handler. Also fixes the attach/intent/explore popovers. tsc-clean (21 pre-existing errors are all `__tests__` baseline). **Action:** land it as a small standalone PR from `lane/refine`, OR carry the change into Phase 3's composer rework. It is currently only on disk in the refine worktree.
2. **Trunk sync:** at session start, local `main` was **53 commits behind** `origin/main` — fast-forwarded (brought the refine-lane merges PRs #92–#102, incl. brand-deals removal, Account Read, Theme-B skeletons, the `docs/OPEN-WORK-BACKLOG.md` SSOT). Trunk is now current (`c0be034c`).
3. **`lane/refine` remains the live debt lane** (persistent dev-server worktree for small step-by-step fixes) — separate from this milestone.

---

## 8. Setup for the fresh session (start here)

```bash
cd ~/virtuna-the-room                    # this worktree (branch milestone/the-room)
git config core.hooksPath .githooks      # enable auto-push (if not already shared)
npm install                              # worktrees do NOT share node_modules
cp ~/virtuna-refine/.env.local .env.local   # env is gitignored — copy from a sibling (has Supabase + engine keys)

# Dev server — GOTCHAS: 768MB heap OOMs the GSI build; the npx wrapper breaks dev.
# Use the node bin directly with a bigger heap:
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000
```

- **Test user:** `e2e-test@virtuna.local` / `e2e-test-password-2026` (log in at `/login`; lands on `/home`).
- **Browser preview via Playwright MCP:** `file://` is blocked — serve HTML over a local `python3 -m http.server`. Standalone HTML needs `<meta charset="utf-8">` or it mojibakes. Screenshots save to the cwd root — clean them up after.
- **Design system:** flat-warm charcoal — bg `#262624`, cream `#ece7de`, terracotta accent `#d97757` (near-zero dosage), 6% borders, 12px card radius, Inter chrome + Newsreader serif for voice moments. SSOT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
- **First move:** resolve the **Bloom vs Floating** fork (§4), then Phase 1 (§5), named-people first.

---

## 9. First-session checklist

- [ ] `cd ~/virtuna-the-room`, `npm install`, copy `.env.local`, start dev (§8).
- [ ] Log in as the test user, re-open both artifacts, re-read §3 (locked) + §4 (open).
- [ ] Decide **Bloom vs Floating**.
- [ ] Decide how to land the **popover fix** (§7.1) — standalone PR or fold into Phase 3.
- [ ] Start **Phase 1**: named-people plumbing + living-presence/Room rebuild + clean composer. Verify live in-browser. Small PR.
