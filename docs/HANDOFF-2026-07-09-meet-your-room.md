# Handoff — "Meet your room" empty state + open follow-up

**Date:** 2026-07-09 · **Worktree:** `~/virtuna-explore-a` (`lane/explore-a`) · **Dev:** :3001
**Shipped:** PR #217 → `main` `98076f94` (squash). Lane reset to merged `main`.

## What shipped

Rethought the idle `/home` ambient-audience empty state. It used to show an abstract
"10 personas ready" + decorative dots + **fabricated tap-to-run starter chips** (generic
filler, and the react API is ~10s / sometimes 502s, so a tap felt dead). Now it shows the
**real named cast** — the product's moat, on screen.

- The idle hero renders the actual 10 people (Maya/high_engager, Dev/tough_crowd, Priya,
  Sam, Jordan, Alex, Theo, Nadia, Elena, Robin), each with a one-line behavior trait, in a
  2-col grid, under a small breathing constellation crown + one honest prompt
  ("Type a thought below and watch the whole room react").
- Calibrated audiences use their own `personas` (creator `label` wins via
  `resolvePersonaName`); **General** carries no persona rows (`GENERAL_AUDIENCE.personas = []`
  in `audience-repo.ts`), so it reads the canonical `GENERAL_ROSTER`.

### Files
- `src/lib/audience/persona-names.ts` — **SSOT** for cast presentation: `ARCHETYPE_TRAIT`
  (short one-liners) + `GENERAL_ROSTER` (ordered 10 archetypes). Client-safe (type-only
  registry import — do not import the registry barrel here).
- `src/components/audience-lens/audience-presence.tsx` — `castMembers` memo + the empty-state
  render (the `castMembers.length > 0` `<ul>` block). Also copy: "10 **people** ready" (hero
  only), honest sub-prompt.
- `src/components/brand/constellation.tsx` — `buildFieldDots` (balanced jittered-grid layout,
  not random scatter) + `threadEdges` (minimum spanning tree → one connected figure) + a
  `connect` prop on `<Constellation>`. The crown passes `connect`.
- `src/components/audience-lens/__tests__/audience-presence.test.tsx` — idle-hero test now
  asserts the prompt + real cast names (Maya, Dev).

### Verification
- `tsc --noEmit` clean.
- Tests: 41/43 pass (`audience-presence` + `reskin-matte`). The **2 failures are pre-existing
  & unrelated** ("v6 Room body when open+focused" + "surface read-only Room") — confirmed
  identical on the clean tree (JSDOM multi-match in the focused-Room path). Run:
  `node ./node_modules/vitest/vitest.mjs run src/components/audience-lens/__tests__/audience-presence.test.tsx src/reading/__tests__/reskin-matte.test.ts`
- Browser pass (authed `/home`, 1440×1000 @2×): 0 console errors. E2E creds:
  `e2e-test@virtuna.local` / `e2e-test-password-2026` (created via `npx tsx e2e/create-test-user.ts`).
  Screenshot script pattern lives in `.scratch/` (gitignored).

## OPEN FOLLOW-UP — `TODO(meet-your-room)`: tap a person → persona chat

The cast is currently **presentational** (rows have no hover/click — deliberately, to avoid a
dead affordance like the removed chips). Make each person tappable to actually **meet them**
("Why'd you scroll past, Dev?").

**Marker in code:** `TODO(meet-your-room)` comment above the `<ul>` in `audience-presence.tsx`.

**Reuse — don't rebuild:** `src/components/audience-lens/PersonaChatDrawer.tsx` already exists
(P9 / Living Audience). API:
- `target: PersonaChatTarget | null` (`null` = closed). `PersonaChatTarget = { archetype, name,
  reaction? }`.
- `onClose: () => void`.
- It POSTs `{ ask, personaGrounding: { archetype, personaName, reactionToConcept? } }` to the
  chat route and GET-rehydrates prior `persona-chat-turn` turns **keyed to a thread**.

**The nuance to solve:** the drawer is designed to be opened from a *Read* where the persona
already has a `reaction` to a concept + a thread context. On the **idle empty state there is no
concept/reaction yet** ("meet them cold"). So wiring needs:
1. A cast-row click → set a `PersonaChatTarget` (archetype from the roster/persona; name from
   `ARCHETYPE_PERSONA_NAME`/label; `reaction` omitted).
2. Confirm the chat route + drawer handle a **null reaction** grounding gracefully (grounding
   from `ARCHETYPE_DEFINITIONS` alone), and that thread-keyed rehydration works with no active
   Read. If not, add a "cold intro" grounding path.
3. Restore a hover/focus affordance on the rows once they're real buttons (was removed).

Keep the matte guard green and don't reintroduce accent (dosage LOCKED, liveness-only).
