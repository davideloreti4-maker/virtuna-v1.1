# Phase 5: Studio Conversation Layer - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

> **Phase re-scoped during discussion (2026-06-18).** ROADMAP P5 was
> "Open Chat & Test Reframe." The owner expanded it into the **Studio
> Conversation Layer** — the integrative phase that makes the whole studio
> *feel like one continuous conversation*: open chat + Test reframe **plus**
> Perplexity-style progress, cards embedded in chat, chat-to-refine with
> context-carry, and the generic skill-to-skill chain plumbing. **Scripts +
> Remix were un-deferred from v6.1** and split into a new **Phase 6: Script &
> Remix Tools** (P6/P7 combined). ROADMAP/STATE edits are a follow-up to this
> discussion (see "Roadmap follow-up" at the bottom).

<domain>
## Phase Boundary

Close the studio by making **idea → hooks → (script) → test feel like ONE flowing conversation**, on the proven P1/P3/P4 substrate. Phase 5 ships, in a single shared open thread per user:

1. **Open chat** (THREAD-03) — profile-grounded general chat with no anchoring Reading, markdown messages, persisting/re-hydrating like any thread (Chat chip flipped live, mirrors the Idea/Hook flips).
2. **Test reframe** (TEST-01) — the existing Reading reframed as **"Test · powered by SIM-1 Max,"** the landing point of every chain CTA; the video/upload scoring path is **unchanged** (presentation/wiring only, no `ENGINE_VERSION` bump).
3. **Conversation layer (owner expansion):**
   - **Perplexity-style progress** — real pipeline-stage checkmarks streamed over SSE while a skill runs.
   - **Cards embedded in chat** — skill cards land in-thread, followed by a short model-authored chat turn.
   - **Chat-to-refine** — "make hook 1 punchier" re-runs the skill scoped to that card → a new, freshly SIM-tested card inline.
   - **Generic skill-to-skill chain plumbing** — one anchor-carry handoff so any skill registers as runner + card + CTA, with full running thread context.

**Requirements (locked by ROADMAP/REQUIREMENTS):** THREAD-03, TEST-01 (+ the expansion realizes THREAD-05 chain CTAs and the THREAD-06 tool-runner end-to-end across skills).

**In scope:** open chat; Test reframe (hero + entry language + brief-on-landing); progress affordance; cards-in-chat + refine; generic chain plumbing built so Script/Remix slot in.

**Out of scope (this phase):** the **Script** and **Remix** skills themselves → **Phase 6** (P5 only builds the plumbing they plug into); any change to the SIM-1 Max video-scoring path; in-thread monetization, brand-profile, RAG-over-history (v6.1+).
</domain>

<decisions>
## Implementation Decisions

### Area 0 — Milestone re-scope / phase structure
- **D-00 (Split, not mega-phase):** Phase 5 = the **Studio Conversation Layer** (open chat + Test reframe + progress + cards-in-chat + refine + generic chain plumbing). **Script + Remix are un-deferred from v6.1** into a new **Phase 6: Script & Remix Tools** (the two combined into one phase — both run the same Qwen pipeline as Test, both have prior art, both are sibling generative skills sharing the SIM-test/card/chain-CTA pattern). Rationale: each generative skill earns its own success-criteria gate (as Ideas/Hooks did); P5 builds the conversation layer generically so P6 plugs in without rework.

### Area 1 — Thread & context model (THREAD-03 / THREAD-05)
- **D-01 (Single open thread, full running context):** Open chat, idea cards, hook cards, future script/remix cards, and all refine-chat live in the **ONE existing open thread per user** (`type:"open"`, `reading_id IS NULL` — the same thread ideas+hooks already append to). Every skill run and every chat turn reads the **whole prior thread** as context, so "chat about this output" and the idea→hooks→script→test flow just work — the model always sees what came before. Reuses the existing persistence/rehydration (`threads_messages` migration, `getOpenThread`, the `/api/threads/open` read-back).
- **D-01a (soft context cap — Claude's discretion):** Default is full running context. The planner MAY add a token ceiling / windowing for very long threads (cost + latency guardrail), but full context is the default behavior to honor the owner's choice.

### Area 2 — Progress affordance (owner expansion)
- **D-02 (Real pipeline stages over SSE → checkmarks):** The progress steps map to **actual pipeline phases** the skill already runs and emits over the existing content-first SSE seam (e.g. *Generating → Self-judge gate → Simulating your audience (SIM-1 Flash) → Ranking*). Each flips to a checkmark as that real stage completes, then cards stream in content-first. **No fake timers** (honesty spine). The "Simulating your audience" beat literally IS the Flash gate — reinforces the moat. Requires the skill SSE routes (ideas/hooks + future script/remix) to emit **named stage events**; the progress affordance is transient UI driven by those events (not necessarily persisted).

### Area 3 — Cards embedded in chat (owner expansion)
- **D-03 (Model-authored, context-aware follow-up):** After a skill's cards render, the skill emits **one short markdown chat turn written by the model**, referencing *this* run ("Hook #2 leans hardest on the skeptic — want it punchier, or should I script the top one?"). It's a real assistant message that persists in the thread and naturally teaches that the thread is conversational. Costs one tiny extra generation per run — accepted for the "it's a conversation, not just cards" payoff.

### Area 4 — Refine flow (owner expansion — the core loop)
- **D-04 (Refine = scoped re-run → new tested card inline):** A refine request ("make hook 1 punchier", "tighten idea 2") **re-runs the relevant skill scoped to that one card** (carrying the user's instruction + the original card as anchor), producing a **NEW card embedded inline, freshly SIM-1-scored** — so the moat holds ("every output tested"; refined output is never an untested rewrite). The model also drops a one-line chat note. Costs one scoped skill run per refine; this is the studio's core loop, so it earns it.

### Area 5 — Intent routing (owner expansion)
- **D-05 (Chip primary + NL refine-detect + tap-to-launch CTAs):** The active tool chip is the explicit signal (**Chat** = converse/refine; **Idea/Hooks/Script** chip = run that skill). Inside chat, the model detects **refine intent** by reference to an existing card ("hook 1", "that idea") → scoped re-run (D-04). Pure chat may **suggest** the next chain step as a **tappable CTA** ("Turn this into hooks →"). **A skill only runs on an explicit chip send or a CTA tap — never a silent auto-fire** (cost honesty + predictability). No full-NL auto-launch router.

### Area 6 — Test reframe (TEST-01)
- **D-06 (Reframe hero + entry; brief above upload):** Rename the Reading **hero/title to "Test"** with a **"powered by SIM-1 Max"** tag, and update the **entry/chip language** to match — a **presentation/wiring change only** (no engine touch, **no `ENGINE_VERSION` bump**, video path unchanged). When a chain CTA ("Test full →") lands here, the **carried hook/idea renders as a visible brief above the upload affordance** ("Shoot this hook → upload → SIM-1 Max scores the real thing"). The honest **Flash-ceiling → Max-realized** ladder, fully wired. (The P4 `testBrief` pre-fill + `handleTestHook` seam is the carry-in mechanism this lands on.)
- **D-06a (rename depth — Claude's discretion, bounded):** Default = hero + entry/chip language + the brief. A *full* sweep of every user-facing "Reading" string (history, permalinks, empty states, `components/reading/*`) is **optional/larger surface** — keep internal nomenclature (`reading_id`, route paths, `analysis_results`) unchanged for stability. Planner decides how far the user-facing sweep goes without touching the protected path.

### Area 7 — Open chat grounding, cold-start & voice (THREAD-03 success criteria #2/#3)
- **D-07 (Tight per-turn assembly):** Each chat turn assembles a **tight curated slice** — niche + relevant craft frame + running thread context — via the existing **`assembleBundle({mode:"chat"})`** (roles already = niche/audience/platform) + the **P2 chat stance-slice (`corpus/chat.md`)**, **NOT** the whole profile/KC. Same anti-dilution discipline as Ideas/Hooks (GROUND-02). Grounded enough to clearly out-answer a generic chatbot.
- **D-08 (Cold-start = graceful degrade + co-pilot voice + gentle nudge):** Thin/no profile → ground on **niche/platform baselines** (reuse the Ideas cold-start path; the assembler already emits an honest cold-start flag) so chat still works, with a **soft one-time nudge** to enrich the profile. **Voice = Numen co-pilot:** concise, opinionated, creator-craft-focused, always tying back to **"your audience"**; **honest about Flash-ceiling vs Max-realized** (never promises views); proactively offers chain steps when relevant (D-05).

### Area 8 — Chain shape (informs P5 plumbing; Script/Remix ship in P6)
- **D-09 (Script mid-chain; Remix alt funnel-top entry):** The spine is **[Remix or Idea] → Hooks → Script → Test**. **Script** sits hooks→script→test (script the chosen hook into a full script, then Test the shot video). **Remix** is an **alternate funnel-top entry** (remix a trending/competitor video or the creator's own winner) that produces ideas/hooks and feeds the **same** chain. **Phase 5 builds ONE generic anchor-carry handoff** so each skill registers as runner + card + CTA with **zero new plumbing** — P6 just plugs in. (Prior art to scout in P6: `src/app/api/analyze/[id]/script/route.ts`, `src/app/api/remix/adapt/route.ts`, the `milestone/viral-remix` worktree.)

### Claude's Discretion
- Soft context cap / windowing for very long threads (D-01a) — default full context.
- Whether the progress affordance is a transient typed block vs ephemeral SSE-driven UI; exact stage labels per skill (must map to real stages — D-02).
- Exact shape of the scoped-refine payload (instruction + original-card anchor) and how the re-scored card replaces/stacks vs the original in-thread (D-04).
- Exact refine-intent NL detection heuristics (card reference parsing) and the suggested-CTA copy (D-05).
- How far the user-facing "Reading"→"Test" sweep extends beyond hero/entry/brief (D-06a) — bounded by the protected path.
- The generic chain-handoff contract surface (how a card declares its available "→ next skill" CTAs) — built to fit Script/Remix (D-09) without over-engineering.
- THEME-06 flat-warm visual system is the design SSOT for all new affordances (progress, brief, chat turns).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 5 — goal + 4 success criteria (note: phase re-scoped per D-00; ROADMAP edit pending).
- `.planning/REQUIREMENTS.md` — **THREAD-03, TEST-01**, THREAD-05 (chain CTAs), THREAD-06 (tool-runner) + cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06).
- `.planning/PROJECT.md` — milestone identity + locked constraints (note: "Scripts + Remix deferred to v6.1" is **superseded by D-00** — they move to P6 this milestone).
- `.planning/STATE.md` — Hard Constraints (engine regression gate, Qwen-only, fixed typed renderers, flat-warm SSOT). The "Scripts + Remix deferred to v6.1" line needs updating per D-00.

### The shapes Phase 5 reuses (prior phase contexts)
- `.planning/phases/04-hooks-tool/04-CONTEXT.md` — the card+gate+stream shape, the "Test full →" handoff (D-05/D-06), `testBrief` / `handleTestHook` carry-in seam, the in-thread chain (D-10).
- `.planning/phases/03-ideas-tool/03-CONTEXT.md` — content-first stream, self-judge gate, legible grounding, cold-start path, "Develop this →" chain seam, in-thread append (D-15 / THREAD-05).
- `.planning/phases/01-engine-thread-foundation/01-CONTEXT.md` — tool-runner (THREAD-06), composer chip/model-field, honesty spine + BandBlock, renderer registry + double-validation, open vs grounded thread model.
- `.planning/phases/02-knowledge-core-generative-rebuild/02-CONTEXT.md` — KC BASE/slice shape, live-tier assembler, the chat stance-slice, KC_GEN_VERSION.

### Knowledge-Core — the chat slice (MUST read)
- `.planning/corpus/chat.md` — the chat **stance-slice** (the voice/discipline open chat rides — D-07/D-08).
- `.planning/corpus/base.md` — shared BASE (Value Bar / self-rejection / Output Discipline) all grounding rides.

### Open chat — grounding assembly (P2 substrate)
- `src/lib/kc/assembler.ts` — `assembleBundle` already supports **`mode:"chat"`** (MODE_ROLES.chat = niche/audience/platform), the honest cold-start flag, and the `anchor` (recent turns for chat). The exact mechanism D-07/D-08 ride.

### Threads / persistence (P1 substrate — D-01)
- `src/lib/threads/threads.ts` — `createOpenThreadLazy` / `getOpenThread` (single open thread per user; partial-unique index).
- `src/lib/threads/messages.ts` — `insertMessage` (in-thread persistence the cards + chat turns reuse).
- `src/app/api/threads/open/route.ts` — the open-thread read-back (rehydration) — extend to carry chat/markdown turns alongside cards.
- `supabase/migrations/20260617000000_threads_messages.sql`, `supabase/migrations/20260618000000_threads_one_open_per_user.sql` — the thread/message schema + one-open-per-user constraint.

### Tool-runner, blocks, SSE (THREAD-06 — progress + cards-in-chat + refine)
- `src/lib/tools/tool-runner.ts` — the THREAD-06 contract + `dispatchToolOutput` + the **markdown path** (`outputSchema: null` → markdown block) open chat + the post-card chat turn (D-03) use; the content-first `stream?` seam D-02 extends with **named stage events**.
- `src/lib/tools/runners/flash-runner.ts`, `ideas-runner.ts`, `hooks-runner.ts` — the runners that emit stage events (D-02) and the scoped re-run for refine (D-04).
- `src/lib/tools/block-registry.ts` — the fixed registry (any new progress/brief block joins here, double-validated).
- `src/components/thread/` — `idea-card-block.tsx`, `hook-card-block.tsx`, `markdown-block.tsx`, `message-blocks.tsx`, `ideas-thread-view.tsx`, `hooks-thread-view.tsx` — the render substrate the conversation layer extends (cards + interleaved markdown chat turns).

### Composer / chips (entry — D-05)
- `src/components/app/home/composer.tsx` — the multipurpose composer + `activeTool` routing + `testBrief`/`handleTestHook` (the chat path + intent routing + the brief carry-in land here).
- `src/components/app/home/tool-chips.tsx` — the **Chat chip exists disabled** (`enabled:false`, "// P5"); flip live (D-05). Model label already maps chat → "SIM-1 Flash".

### Engine — protected SIM-1 Max path (do NOT regress)
- `src/lib/engine/version.ts` — `ENGINE_VERSION`; **do NOT bump** (P5 is text-path chat + presentation reframe; Max untouched).
- `src/lib/engine/__tests__/` — the engine suite that MUST stay green (same-video Max score-identity preserved).
- `src/app/api/analyze/[id]/chat/route.ts` + `src/lib/chat/seed-context.ts` — the **existing grounded-over-Reading chat** (analogous SSE streaming + history pattern to reuse for open chat — but open chat grounds on profile/KC, NOT an analysis row).

### Test reframe targets (TEST-01 — D-06)
- `src/components/reading/reading-hero.tsx` — the title/hero to relabel "Test · powered by SIM-1 Max".
- `src/components/reading/reading.tsx`, `reading-chat.tsx`, `index.ts` — the Reading surface + where the landing brief mounts above the upload affordance.

### P6 prior art (scout in Phase 6 — not built here)
- `src/app/api/analyze/[id]/script/route.ts` — existing script generation (Script skill prior art).
- `src/app/api/remix/adapt/route.ts` — existing remix/adapt (Remix skill prior art); `milestone/viral-remix` worktree per the STATE constraint ("scout before any rebuild").
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Single open thread + persistence** (`threads.ts` `getOpenThread`/`createOpenThreadLazy`, `messages.ts` `insertMessage`, `/api/threads/open`) — D-01 reuses this verbatim; chat/markdown turns interleave with cards in the same thread.
- **`assembleBundle({mode:"chat"})`** (`assembler.ts`) — chat grounding + cold-start flag + `anchor` already exist; D-07/D-08 ride it with zero schema change.
- **`corpus/chat.md`** — the authored chat stance-slice (P2) the voice rides (D-08).
- **Tool-runner markdown path** (`outputSchema:null → markdown block`) — the natural renderer for open chat answers + the post-card follow-up turn (D-03).
- **Content-first SSE seam** (`stream?` in tool-runner; ideas/hooks routes) — D-02 extends it with named stage events for the progress checkmarks.
- **`testBrief` / `handleTestHook`** (composer.tsx, P4) — the chain carry-in mechanism the Test reframe lands on (D-06).
- **Disabled Chat chip** (`tool-chips.tsx`, "// P5") — flip live (D-05).
- **Existing grounded chat** (`/api/analyze/[id]/chat`, `seed-context.ts`) — analogous streaming+history pattern (different grounding source).

### Established Patterns
- **Honesty spine** — no fake progress timers (D-02), no untested refined output (D-04), no fabricated numeric/view-count score, honest Flash-ceiling vs Max-realized (D-06/D-08).
- **Anti-dilution grounding (GROUND-02)** — tight per-turn slice, not whole-profile (D-07).
- **Engine OPEN but regression-gated** — P5 is text-path + presentation only; suite green, Max same-video score-identity preserved, **no `ENGINE_VERSION` bump**.
- **In-thread chain (P3 D-15 / P4 D-10)** — everything appends in the one open thread; chain CTAs move between tools (THREAD-05).
- **Fixed typed-renderer library (THREAD-04)** — any new progress/brief affordance is a registered, double-validated block, NOT model-generated UI.

### Integration Points
- **Chat turn → `assembleBundle({mode:"chat"})` → Qwen (markdown stream) → markdown block** persisted in the open thread; multi-turn history = the thread itself (D-01).
- **Skill run → named SSE stage events (progress checkmarks) → cards stream content-first → model-authored follow-up chat turn** (D-02/D-03).
- **Refine turn (NL refine-detect, D-05) → scoped skill re-run (instruction + card anchor) → new SIM-scored card inline + chat note** (D-04).
- **Chain CTA tap ("Test full →") → Reading reframed as "Test · powered by SIM-1 Max" with the carried hook/idea as a visible brief above upload** (D-06).
- **Generic chain handoff** — built so Script/Remix register as runner+card+CTA without new plumbing (D-09).

### Watch-outs
- The **protected SIM-1 Max video path** must not regress — D-06 is presentation/wiring only.
- **Rehydration** must now carry interleaved markdown chat turns + multiple card versions (refine produces new cards) — extend `/api/threads/open` read-back + the home rehydration effect (composer.tsx `loadPersistedBlocks`, currently filters only `idea-card`/`hook-card`).
- **Cost** — full running context (D-01) + per-run follow-up turn (D-03) + scoped re-runs (D-04) each add calls; keep within the bounded-cost constraint (soft cap D-01a is the lever).
</code_context>

<specifics>
## Specific Ideas

- **"One continuous studio conversation"** (owner, 2026-06-18) — idea→hooks→script→test must feel like one thread where context is kept; cards embedded in chat; the user can chat about any output and refine to their vision. The whole milestone's integrative payoff.
- **Perplexity-style progress** (owner, 2026-06-18) — explicit reference: the satisfying checklist-completing texture ("creating.., analyzing.., simulating your audience..") with checkmarks → must be **real stages**, not theater (D-02).
- **"Card, then a short chat text"** (owner, 2026-06-18) — after the cards, a brief conversational line so the user understands it's not only cards — they can converse to refine further (D-03).
- **"Refine to the user's vision"** (owner, 2026-06-18) — refine re-runs scoped and re-tests, so the moat ("SIM-1 on everything") holds even on refined output (D-04).
- **Remix runs the same Qwen pipeline as Test; Script + Remix combined into one phase** (owner, 2026-06-18) — drove D-00/D-09.
</specifics>

<deferred>
## Deferred Ideas

- **Script & Remix skills themselves** → **Phase 6: Script & Remix Tools** (un-deferred from v6.1 per D-00). P5 builds only the generic plumbing they plug into (D-09). Scout prior art in P6.
- **Full-NL auto-launch router** (model classifies + auto-fires every turn) — rejected for P5 (cost/misfire risk); chip + tap-to-launch is the boundary (D-05). Possible future refinement.
- **Full app-wide "Reading"→"Test" string sweep** (history, permalinks, all `components/reading/*`) — beyond the hero+entry+brief default; optional larger sweep at planner discretion (D-06a), internal nomenclature stays.
- **Generate → critique → regenerate quality loop** (backlog lever #3) — refine (D-04) is a *user-initiated* scoped re-run, not an autonomous regen loop; the autonomous loop stays future.
- **In-thread monetization, brand-profile entity, RAG-over-creator-history, desktop dense-instrument** — v6.1+ (per STATE Deferred Items).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.
</deferred>

---

## Roadmap follow-up (NOT part of CONTEXT — action items from D-00)

These edits should be applied to ROADMAP.md / STATE.md / PROJECT.md before/as Phase 5 planning proceeds (via `/gsd-phase` or manual edit):

1. **Rename Phase 5** "Open Chat & Test Reframe" → **"Studio Conversation Layer"**; expand its goal + success criteria to cover progress UX, cards-in-chat, refine, and generic chain plumbing (THREAD-03, TEST-01, THREAD-05, THREAD-06).
2. **Add Phase 6: Script & Remix Tools** (combined) — un-deferred from v6.1; reuses P5 chain plumbing; scout `analyze/[id]/script`, `remix/adapt`, `milestone/viral-remix` prior art.
3. **Update the "Scripts + Remix deferred to v6.1" line** in STATE.md Hard Constraints + PROJECT.md to reflect P6.

---

*Phase: 5-Studio Conversation Layer*
*Context gathered: 2026-06-18*
