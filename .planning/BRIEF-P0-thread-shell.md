# Brief — P0: Thread Shell + Skill-Output Card (de-Claude track)

> **For:** Cursor (UI track, `design/ui-restrained` lineage) · **Author:** planning/coordination
> **Read first:** `.planning/HANDOFF-ui-restrained.md` (the de-Claude rules) → this file.
> **Prereq:** the recolor commit (`923183a3 fix(ui): subtract accent flood`) must be **merged**
> into `design/ui-restrained` first. Build forward from that base, not from the bare branch.

---

## 1. Why this is P0

A live visual audit (logged-in, 1440×900) found that the recolor succeeded but exposed the real
problem: **only the Reading (`analyze/[id]`) is actually designed.** Chat, every skill output, and
the home screen share three structural defects, all presentation-layer:

1. **No conversation/thread shell.** Chat + skills render inline on `/home` while the serif greeting
   stays pinned at its 18vh anchor. The user's question is **never echoed**, assistant answers are a
   **raw wall of text**, there is no turn framing, no roles, no result chrome.
2. **No shared skill-output container.** Each `*ThreadView` renders its own bare 760px column. The
   Explore/outlier output **overflows horizontally and bleeds onto the home canvas** with no card.
3. **Loading is an afterthought.** The chat "loading" state is the literal word **"Thinking…"** in
   plain gray text, dead-center in empty space.

Fixing the shell repairs **chat + all six skill outputs + the broken home** in one structural move.
This is the single highest-leverage UI task in the backlog.

**Reference bar:** the Reading surface (`src/components/reading/`). Match its density, framing, and
hierarchy. Screenshots of the current broken state are in `~/virtuna-ui-restrained/audit-*.png`
(`audit-06-chat-loading`, `audit-07-chat-result`, `audit-01-home`).

---

## 2. Hard boundary — engine-rework is running in parallel

The `rework/engine-core` worktree is **rewriting the audience data model + skill runners** concurrently.
The merge is clean **only if you stay in your lane.**

**⛔ DO NOT TOUCH (engine-owned — guaranteed conflict / contract break):**
- `src/components/audience/calibration-flow.tsx`, `src/components/audience/audience-reveal.tsx` (HOLD)
- Anything under `src/lib/**`, `src/app/api/**`, `supabase/**`
- **Block schemas & contracts:** `src/lib/tools/blocks.ts`, `block-registry.ts`, `validateBlock`,
  `chain-handoff.ts`, and every `*Block` renderer's **props signature** (`{ block }`). These are the
  "no model-generated UI" contract (D-14). You may restyle a renderer's *output markup*; you may NOT
  change what props it accepts or what block types exist.
- The stream hooks (`useChatStream`, `useIdeasStream`, `useAnalysisStream`, etc.) and their SSE shapes.
- `onSuggestChain` semantics: chain CTAs render as tappable buttons and **never auto-fire** (D-05).

**✅ This brief is presentation-only.** Relayout/reframe/restyle. No data contracts, no props, no schemas.

**Also defer:** the **Audience surface redesign** (`/audience` CRUD-list → rich cards) is a separate
P1 — it waits until engine-rework merges, because it depends on the new persona/signature shape.
Do not start it in this brief.

---

## 3. Current architecture (so you don't fight it)

- `src/app/(app)/home/page.tsx` → `home-page-layout.tsx` (client) holds `hasThread` state and the
  greeting anchor. **Greeting is pinned at `clamp(3rem,18vh,7rem)` by design and does NOT recede** —
  that's defect #1.
- `composer.tsx` (65KB monolith — do **not** refactor it here) owns 6 skill streams and mounts one
  `*ThreadView` per skill in a scroll region **above** the pinned form when `hasThread` is true:
  `IdeasThreadView`, `HooksThreadView`, `ChatThreadView`, `ScriptThreadView`, `RemixThreadView`,
  `ExploreThreadView` (`src/components/thread/*-thread-view.tsx`).
- Each ThreadView renders engine blocks via `MessageBlocks` (`message-blocks.tsx`) →
  `BLOCK_REGISTRY` → per-type renderers (`markdown-block`, `hook-card-block`, `idea-card-block`,
  `script-card-block`, `remix-card-block`, `outlier-grid-block`, `personas-block`, …).
- `markdown-block.tsx` already uses `prose prose-invert prose-sm` — the wall-of-text is from missing
  **turn framing + width/echo**, not missing prose.

---

## 4. What to build

### A. `ThreadShell` — the conversation container (NEW component)
`src/components/thread/thread-shell.tsx`. A shared wrapper every `*ThreadView` renders inside.
- Owns the column (max-w-[760px], centered, consistent vertical rhythm, `gap` matching the Reading).
- Renders **turns**, not a flat block stream:
  - **User turn** — echo the submitted prompt as a right-aligned (or clearly user-styled) message.
    Source: the just-submitted composer draft (optimistic, client-side, presentation-only — do **not**
    invent a persisted user-message schema). If a view has no access to the draft, accept it as a prop
    from the composer; coordinate the prop, but keep it presentation state.
  - **Assistant turn** — the existing blocks via `MessageBlocks`, wrapped in a turn container with
    quiet role affordance (small Numen mark / label), consistent padding, separation between turns.
- Flat-warm + matte (no glass/glow/shine). Accent stays neutral — no red (per HANDOFF dosage rule).

### B. `SkillResultCard` — the output frame (NEW component)
`src/components/thread/skill-result-card.tsx`. The bounded container each skill's payload mounts in.
- Header row: skill name + audience context (e.g. "Hooks · Fitness Creators") — quiet, muted.
- **Contains overflow** — the outlier grid / multi-column payloads must scroll/wrap **inside** the
  card, never bleed onto the page (fixes the home overflow, `audit-01-home.png`).
- 12px radius card, 6% border, matches Reading card chrome.
- `ExploreThreadView` + `outlier-grid-block` are the priority consumers (worst offenders today).

### C. Greeting recede
In `home-page-layout.tsx` / `home-greeting.tsx`: when `hasThread` is true, the greeting collapses /
recedes (shrinks + fades, or scrolls away above the thread) so the conversation owns the screen.
Empty home is unchanged. Respect `prefers-reduced-motion` (no animated collapse → instant state).

### D. Branded loading states
Replace the bare `Thinking…` (in `chat-thread-view.tsx`) and the equivalent idle/progress text in the
other ThreadViews + `progress-checklist.tsx` with a **branded skeleton + the constellation motif**.
- The `Constellation` exists and is mature in
  `src/components/audience-lens/audience-presence.tsx` (seeded, reduced-motion-safe). Extract it to a
  reusable component (e.g. `src/components/brand/constellation.tsx`) and use it as the loading
  affordance. **Verify the extraction does not alter `audience-presence.tsx` behavior** (it imports
  the extracted version).
- Skeletons should hint the result shape (card outline), not a generic spinner.

---

## 5. Acceptance criteria (prove each with a screenshot)

1. Send a **Chat** message on `/home`: the question renders as a user turn; the answer renders as a
   framed assistant turn (not a wall under the greeting); greeting has receded.
2. **Loading** shows the branded skeleton + constellation, not the word "Thinking…".
3. Run **Explore** on `/home`: outlier output sits inside `SkillResultCard`, **no horizontal overflow
   / no bleed** onto the canvas.
4. Hooks / Ideas / Script / Remix outputs all render inside the shared shell + result card with
   consistent framing.
5. Reading (`analyze/[id]`) is **unchanged** (it's already the bar; don't regress it).
6. `prefers-reduced-motion`: greeting recede + constellation are static.
7. Chain CTAs still render as tappable buttons and never auto-fire.

## 6. Verification gates (per HANDOFF §9)
- `npm run lint` + typecheck clean.
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` green.
- Existing thread tests green (`src/components/thread/__tests__/`, `explore-thread-view.test.tsx`).
- Run `/design-check` on the diff (dosage, neutral actions, accent≠error, HOLD files untouched).
- **Visual proof** — before/after screenshots of chat, home/Explore, a loading state.

## 7. Sequencing & merge discipline
- **Rebase on `origin/main` before starting and before the PR** (catch the engine merge).
- Keep it to **small per-step PRs** if it helps: (A+C shell+greeting) → (B result card) → (D loading).
  Commit format `type(thread): description` / `type(home): …`.
- After this lands, next up (still conflict-free): **P2 Library** redesign, then — **only after
  engine-rework merges + rebase** — **P1 Audience surface** redesign.

---
**State at brief:** audit complete; recolor verified not to touch HOLD files (clean merge with engine).
This brief is the unlock; the full phased backlog lives in the conversation that produced it.
