# Premium thread — BUILD SPEC (Chunk 1 + 2)

> Lane `lane/shell` · 2026-06-28. Sketch **signed off at v3.2** (`premium-thread.html`). This is the
> contract that turns it into app code. Companions: `docs/subsystems/ui-loading-states.md` (audit + seams),
> `premium-thread-copy-floor.md` (the locked copy decisions). **Client-side only; no engine change** (one
> filed engine ask, optional/deferred). Verify with a real browser pass (vitest can't catch client/server
> bundle leaks — see memory `ui-verify-needs-browser-pass`).

## Split (recommended — two reviewable PRs)

- **PR-1 / Chunk 1 — switch & submit mechanics** (loading correctness; no stream/card changes): **A1 + A2 + A3.**
- **PR-2 / Chunk 2 — card pending + conversational frame** (the premium voice layer): **A4 + intro slot +
  outro restyle + spine refine + static sub-detail + chips.**

Rationale: PR-1 is pure layout/feedback on the `#70/#72` multi-thread surface — high value, contained, no
risk to the stream pipeline. PR-2 touches the stream hooks + card renderers + thread views. Keeping them
apart keeps each diff small and the gnarliest fix (A1) isolated.

---

## PR-1 — switch & submit mechanics

### A1 — thread-switch: shell + skeleton, never the hero-flash  ·  size M  ·  the worst current UX
**Files:** `src/components/app/home/composer.tsx` (effect on `[activeThreadSignal]` ~`:381`, sync wipe
`:388–405`, async `loadPersistedBlocks` `:408`; `hasThread` `:280`, `hasConversationContent` `:321`) ·
`src/components/app/home/home-page-layout.tsx` (hero gate ~`:37`, thread-layout gate ~`:48`).
**Change:**
1. Add a `rehydrating` boolean (state or ref-backed state) in the composer. Set it **true synchronously at
   the very top** of the `[activeThreadSignal]` switch effect (before the `*.reset()` / `setPersisted*([])`
   wipes), set it **false** in the `finally`/settle of `loadPersistedBlocks()`.
2. Plumb `rehydrating` into `HomePageLayout`. Gate the **hero** on `!hasConversation && !rehydrating`; keep
   the **full-height thread layout** mounted on `hasThread || rehydrating`. Net: the shell never collapses
   to the centered serif welcome-hero during a switch.
3. In the thread scroll region, while `rehydrating && blocks.length === 0`, render
   `<ThreadLoadingSkeleton variant="chat" caption="Opening thread…" />` (sketch: A1 demo main pane).
**Constraint (DO NOT remove):** the `await activateThread.mutateAsync(id)` in
`Sidebar.handleOpenThread` (`src/components/sidebar/Sidebar.tsx:291`) is load-bearing — `/api/threads/open`
returns the most-recently-touched thread, and `activateThread` is what makes the target newest. The gap is
real; we **cover** it with the skeleton, we don't close it by dropping the await.
**Done when:** clicking a past thread shows skeleton-in-shell → content, with **zero** hero flash, on a
throttled-network browser pass.

### A2 — thread-row pending feedback  ·  size S  (front half of A1's gap)
**Files:** `src/components/sidebar/Sidebar.tsx` (`ThreadRow` `:179`, `handleOpenThread` `:291`).
**Change:** track `activatingId: string | null` in `Sidebar`; set before the `await`, clear after. On the
row, render a pending affordance matching the sketch: **terracotta left-border (2px) + dim (opacity .6) +
slow pulse**; optional inline `<Spinner size="sm">`. (Sketch `.sd-row.pending`.) Optional: optimistically
move the activated row to index 0.
**Done when:** the clicked row signals immediately (no dead 100–400ms).

### A3 — test / URL submit feedback  ·  size S
**Files:** `src/components/app/home/composer.tsx` (test path `:813` / `:855` — never calls
`captureUserTurn`; submit button `loading={submitting}` ~`:1362`).
**Change:** on the test/upload path, before navigation, (a) echo the URL/intent via `captureUserTurn(...)`
(optimistic right-aligned bubble) and/or (b) render a muted status line under the composer driven by
`stream.phase` ("Starting analysis…"). Additive, low-risk; closes the longest silent wait.
**Done when:** submitting a TikTok URL shows an instant echo + status, not just a spinning button.

---

## PR-2 — card pending + conversational frame

### A4 — unscored → scored proof  ·  size M
**Files:** `src/hooks/queries/use-hooks-stream.ts` (`toBlocks` `:487`) + `use-ideas-stream.ts` (same shape) ·
the `HookCardBlock`/`IdeaCardBlock` props type · `src/components/thread/proof-unit.tsx`.
**Change:**
1. The card already carries `scored` (set `true` when the `score` event patches `band`/`fraction` —
   `use-hooks-stream.ts`). **Thread it through:** add `scored: c.scored ?? false` to the block `props` in
   `toBlocks()` (+ the props type).
2. In `ProofUnit`, when `!scored`: render the **pending** treatment from the sketch — a matte-shimmer strip
   (`<Skeleton>`) reading **"Scoring with your 10 reactors…"** in place of the band chip + "N/10 stopped" +
   ribbon. Keep the scroll-quote + "See the room" visible (they ship with the card). When `scored` flips
   true, cross-fade to the band + fraction + ribbon (ribbon wipe `scaleX 0→1`). (Sketch `.proof.scoring`.)
**Done when:** cards visibly arrive pending and resolve their proof in — no silent band/fraction swap.

### Conversational frame (the premium voice layer)
All of this is the **`ThreadAssistantTurn`/SkillResultCard** seam (intro slot above the card group, outro
slot below). Per the locked copy floor:

- **Intro slot (NEW, thin orientation).** Add an `introLine(skill, audience, {hookLine?})` templating helper
  (strings in `premium-thread-copy-floor.md §2`). Render it above the card group with the sketch's
  **word-fade** reveal (blur→sharp, per-word). Hooks/ideas = audience-only orientation; script = cites the
  input hook. **No scores cited pre-card.**
- **Outro slot (restyle, NOT new).** `followupText` already renders as markdown
  (`hooks-thread-view.tsx:142`, ideas `:141`, script `:130`). Wrap it in the same word-fade treatment +
  extract the forward action(s) into **chips** derived from real card handoffs (hook→script, hook→test).
  When `followupText` is null, fall back to `outroFallback(skill, topCard)` or render nothing — never
  fabricate.
- **Spine (refine `ProgressChecklist`).** `src/components/thread/progress-checklist.tsx` — restyle the stage
  rows into the **connected spine** (accruing checks, spine fills to next, active step pulses terracotta).
  Driven by the real `stages: StageState[]`. Pass `caption={statusMessage}` everywhere (fixes A6:
  `script-thread-view.tsx:114`, `remix-thread-view.tsx:115` currently drop it).
- **Sub-detail (static now).** Render `stage.detail ?? STAGE_COPY[stage.name]` (the `STAGE_COPY` map in
  copy-floor §2). No live counter. **Single line per stage** — calm on long/stalled waits.
  - 🔧 **FILED ENGINE ASK (deferred, optional):** add `detail?: string` to the stage SSE event +
    `StageState` so the backend can stream true live status; chrome already renders it via the `??` above.
    Carry to the GSI/engine lane — not a PR-2 blocker.

**Done when:** a skill turn reads intro → cards → outro+chips, the progress is the spine with a static
sub-line, and nothing on screen states a fact we don't have.

---

## Out of scope (explicitly)
Engine/SSE changes (only the one filed `detail` ask, deferred) · living AudienceLens "ask them why" persona
chat (P9) · partial-retry backend for the error state (render the static error UI only if/when wired) ·
route-level skeletons (Theme B) + primitives debt (Theme C) — separate later chunks.

## Verification (per PR)
1. `node ./node_modules/vitest/vitest.mjs run` (the rtk shim makes `npm test` lie — memory `vitest-rtk-shim`).
2. **Real browser pass** (the load-bearing gate — memory `ui-verify-needs-browser-pass`): thread-switch with
   throttled network (A1 no flash), row pending (A2), test-submit echo (A3); for PR-2, watch a hooks run
   stream cards pending→scored (A4) + the intro/outro/spine. Auth via `e2e/create-test-user.ts`.
3. `tsc --noEmit` clean on the diff; reskin-matte guard test stays green (`reading/__tests__/reskin-matte.test.ts`).
