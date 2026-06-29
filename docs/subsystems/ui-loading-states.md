# UI Surface: Loading & pending states — audit + work map

> Lane: `lane/shell` (chrome). Date: 2026-06-27. Design SoT: `docs/DESIGN-SYSTEM.md` + `src/app/globals.css`.
> Status: **AUDIT — not yet built.** This is the recon map that drives the next `lane/shell` chunks.
> Sibling spec: `docs/subsystems/ui-skill-cards.md` (the *resting* card design; this doc owns their
> *loading/pending* states). Continues the chrome pass shipped in PR #72 (route skeletons for
> brand-deals/discover/referrals; error/404 reskin).

## 0. The one finding that frames everything — primitives ALREADY exist

Build on these; do **not** invent new ones.

| Primitive | File | Use for |
|---|---|---|
| `<Skeleton>` (matte shimmer gradient) | `src/components/ui/skeleton.tsx` | the canonical skeleton brick — every route/inline skeleton |
| `ThreadLoadingSkeleton` (`variant="skill" \| "chat"`, constellation + caption) | `src/components/thread/thread-loading.tsx:24` | the in-thread "skill is running" gate |
| `ProgressChecklist` (Perplexity-style stage rows) | `src/components/thread/progress-checklist.tsx:34` | streamed SSE stages |
| `ReadingSkeleton` (IA-mirroring + real-signal liveness) | `src/components/reading/reading-skeleton.tsx:24` | the video Read / analyze surface |
| `<Spinner>` (SVG, currentColor) | `src/components/ui/spinner.tsx:76` | inline button/affordance pending |
| `useToast()` / `<ToastProvider>` | `src/components/ui/toast.tsx` | async-action feedback (mounted app-wide) |

**Dead Raycast-era orphans to delete** (pollute `src/components/primitives/`, zero app imports):
`GlassSkeleton`, `GlassToast`. Also `card-reaction-at-rest.tsx` (+ test) — orphaned, SSOT-confirmed dead.

---

## 1. THEME A — In-thread loading (highest value; owner-flagged "really important")

The thread/chat surface (`/home`) is the core loop: submit → skill runs → cards/Read come back. This is
where the longest waits meet the weakest feedback. Items ranked by pain.

### A1 — Thread-switch layout thrash + welcome-hero flash  ·  size M  ·  **worst UX in the product**

**Symptom.** Click a past thread in the sidebar → the composer's content blanks → the layout snaps back
to the centered **serif welcome-hero** → ~100–500ms later the thread content loads and the layout snaps
back to thread-mode. Two-stage flash on every switch.

**Mechanism.**
- `Sidebar.handleOpenThread` (`src/components/sidebar/Sidebar.tsx:291`) → `await activateThread.mutateAsync(id)`
  → `switchThread()` (bumps `activeThreadSignal`) → `router.push("/home")`.
- The composer effect keyed on `activeThreadSignal` (`src/components/app/home/composer.tsx:381`, deps `[activeThreadSignal]`)
  runs and **synchronously wipes everything FIRST** (`composer.tsx:388–405`): `*.reset()` on all streams,
  `setPersisted*Blocks([])`, `setLastUserTurn(null)`, `setOpenThreadId(null)` — *before* the async
  `loadPersistedBlocks()` fetch (`composer.tsx:408–465`) repopulates.
- `hasThread` (`composer.tsx:280`) and `hasConversationContent` (`composer.tsx:321`) are derived from those
  now-empty arrays → both flip **false** for the duration of the fetch.
- `HomePageLayout` (`src/components/app/home/home-page-layout.tsx`) gates the hero on `!hasConversation`
  (line 37) and the full-height thread layout on `hasThread` (line 48). With both false, the hero renders
  and the thread layout collapses → the flash. When the fetch resolves, blocks repopulate → both flip true
  → layout reverts.

**Constraint (do NOT "fix" by removing the await).** `loadPersistedBlocks()` reads `GET /api/threads/open`,
which returns the *most-recently-touched* open thread. `activateThread` is what touches the target thread so
it becomes newest. The await is load-bearing: activate must commit server-side before `/open` is read, or the
rehydrate returns the *old* thread. So the gap between click and content is real and required.

**Fix direction.** Add a `rehydrating` flag set true synchronously at the top of the switch effect and cleared
when `loadPersistedBlocks()` settles. Keep the thread shell mounted during rehydrate (gate the hero on
`!hasConversation && !rehydrating`, keep `hasThread || rehydrating` for the layout) and render
`ThreadLoadingSkeleton` in the scroll region until new blocks land. Net: swap-with-skeleton instead of
clear → hero-flash → refill.

### A2 — Thread-row click lag has no feedback  ·  size S  (compounds A1)

**Symptom.** Between clicking a thread row and anything happening, the row gives zero signal — looks dead for
the 100–400ms `activateThread` round-trip (this is the front half of A1's gap).

**Mechanism.** `ThreadRow` (`src/components/sidebar/Sidebar.tsx:179`) styles only `isActive`; there is no
"activating/pending" state. `handleOpenThread` awaits the mutation before any visual change.

**Fix direction.** Track `activatingId: string | null` in `Sidebar`; set before the await, clear after. On the
row, show a pending affordance (muted opacity + `animate-pulse`, or a terracotta left-border / inline
`<Spinner size="sm">`). Optional: optimistically move the activated row to index 0.

### A3 — Test / URL submit → navigation silence  ·  size S

**Symptom.** Submitting a TikTok URL or video upload (the `/test` → video Read path) shows **only a spinning
submit button** for 1–3s — no message echo, no status line — until SSE emits `started` and we navigate. Longest
single silent wait. (By contrast the skill paths feel instant.)

**Mechanism.** Skill paths call `captureUserTurn(ask)` → optimistic right-aligned echo + immediate
`ThreadLoadingSkeleton`/`ProgressChecklist`. The test path **never** calls `captureUserTurn`
(`composer.tsx:813`, `:855`); it just `setSubmitting(true)` → button `loading={submitting}` (`composer.tsx:~1362`)
→ waits for `stream.analysisId` to flip null→string, then navigates.

**Fix direction.** On the test path, render a muted status line under the composer driven by `stream.phase`
("Starting analysis…"), and/or echo the URL via `captureUserTurn` before navigation. Low risk, additive.

### A4 — Unscored cards rewrite silently  ·  size M

**Symptom.** Skill cards (hooks/ideas) stream in **before** their scores. They render fully formed but with
placeholder `band="Mixed" · fraction="–"`, then **silently** rewrite the band chip + fraction when the matching
`score` SSE event arrives. No "scoring in flight" affordance — the proof unit just changes under the user.

**Mechanism.** `toBlocks()` in `src/hooks/queries/use-hooks-stream.ts:487` sets `band: c.band ?? 'Mixed'`,
`fraction: c.fraction ?? '–'` (same pattern in `use-ideas-stream.ts`). `ProofUnit`
(`src/components/thread/proof-unit.tsx`) renders those placeholders with no pending treatment.

**Fix direction.** Thread a `scored`/`_pending` flag through `toBlocks()` → `ProofUnit` shows a subtle
`animate-pulse` (or "scoring…" micro-label) on the proof unit while `!scored`. Touches the two stream hooks,
the block prop type, and `ProofUnit`.

### A5 — Account Read has no dedicated loading view  ·  size M

**Symptom.** While the Account Read scrape + LLM analysis runs (seconds→tens of seconds), the user sees
`ThreadLoadingSkeleton variant="chat"` (prose text-lines) — the wrong shape for a profile read.

**Mechanism.** No `account-read-thread-view.tsx`; Account Read is delivered through the chat surface
(`src/components/thread/chat-thread-view.tsx:149`).

**Fix direction.** Add a dedicated `account-read-thread-view.tsx` with a shaped skeleton (mock profile header +
content bars).

### A6 — Script / Remix skeleton drops the status caption  ·  size S

**Symptom.** Script and Remix show only the generic "Running your skill…" even when the SSE provides a more
specific `statusMessage`.

**Mechanism.** `script-thread-view.tsx:114` and `remix-thread-view.tsx:115` render
`<ThreadLoadingSkeleton variant="skill" />` with **no `caption` prop** — unlike hooks/ideas which pass
`caption={statusMessage ?? undefined}`.

**Fix direction.** Pass `statusMessage` through. One-line each.

### A7 — Thread delete is not optimistic  ·  size S

**Symptom.** Deleting a thread leaves the row visible until the list refetch completes.

**Mechanism.** The archive mutation (`src/hooks/queries/use-threads.ts:73`) only `invalidateQueries` on success —
no `onMutate` optimistic removal.

**Fix direction.** Add `onMutate` → `queryClient.setQueryData(queryKeys.threads.list(), old => old?.filter(t => t.id !== id))`
with rollback on error. (Same pattern would smooth create/activate.)

#### Bonus (not strictly loading): Explore double-renders skeleton + checklist
`explore-thread-view.tsx:279–287` shows `ProgressChecklist` AND `ThreadLoadingSkeleton` simultaneously while
streaming (every other view gates the skeleton out behind `stages.length === 0`). Arguably intentional given
explore's explicit "this can take a few minutes" caption, but it's noisier. Size S if we normalize it.

---

## 2. THEME B — Route-level loading skeletons (continues PR #72)

Data routes that currently fall through to the **misleading generic grid** (`src/app/(app)/loading.tsx`) or to
blank. The matte `<Skeleton>` primitive already exists; each item is a per-route `loading.tsx` shaped to its page.

| Route | Now | Fix | Size | Pri |
|---|---|---|---|---|
| `(app)/home` | generic grid skeleton — page is greeting + composer | `home/loading.tsx`: greeting anchor + composer box | M | P0 |
| `(app)/analyze/layout.tsx:26` | `<Suspense fallback={null}>` → **blank main surface** | swap for a Reading-column skeleton | M | P0 |
| `(app)/library` | generic grid — page is a list | `library/loading.tsx`: title + saved-item rows | M | P1 |
| `(app)/audience` | generic grid — core feature | `audience/loading.tsx`: title + New btn + audience rows | M | P1 |
| `(app)/audience/[id]` | inline `DetailSkeleton` only post-hydration; SSR gap shows generic | promote to route `loading.tsx`; extract `audience-detail-skeleton.tsx` | S | P1 |
| `(app)/audience/new` | generic flash | `audience/new/loading.tsx`: title + inputs + button | S | P2 |
| `(app)/competitors/[handle]`, `/compare` | raw `animate-pulse` divs (no shimmer; compare too faint at `bg-white/[0.03]`) | swap to `<Skeleton>`; bump faint bg to `0.05` | S | P3 |

(`brand-deals`, `discover`, `referrals`, `settings`, `competitors` already have good `loading.tsx` from #72/prior.
Marketing/onboarding routes are static or instant — no skeleton needed.)

---

## 3. THEME C — Primitives / MATTE debt / cleanup (cheap, low-risk)

| Item | Where | Size |
|---|---|---|
| **Toast MATTE violation** — visible inset-shine (+ dead backdrop-filter) | `src/components/ui/toast.tsx:213–216` | S |
| **Card inset-shine** — banned by MATTE; `<Card>` is used broadly | `src/components/ui/card.tsx:61` | S |
| Delete dead `GlassToast` + de-export | `src/components/primitives/GlassToast.tsx`, `primitives/index.ts` | S |
| Delete dead `GlassSkeleton`/`SkeletonText`/`SkeletonCard` + de-export | `src/components/primitives/GlassSkeleton.tsx`, `primitives/index.ts` | S |
| Delete dead `card-reaction-at-rest` (+ test) | `src/components/audience-lens/card-reaction-at-rest.tsx` (+ `__tests__`) | S |
| Unify Button + Input `loading` → `<Spinner>` (currently lucide `Loader2`) | `src/components/ui/button.tsx:179`, `input.tsx:191` | M |
| Replace hand-rolled pricing spinner with `<Spinner>` | `src/app/(marketing)/pricing/pricing-section.tsx:113` | S |
| Stale JSDoc: button "coral accent", toggle "coral/glow", skeleton "GlassSkeleton" comments | `button.tsx`, `toggle.tsx`, `skeleton.tsx` | S |
| Shared `<SurfaceEmptyState>` — extract the icon-well+heading+copy+CTA shape from 3 hand-rolled empty states | `competitor-empty-state.tsx` + `deals-empty-state.tsx` + saved-shelf | M |
| (out of lane scope) surviving coral `MARKER_RING_COLOR.fyp = '#FF7F50'` | `src/components/board/audience/audience-constants.ts:91` | XS — flag for board refactor |

**Reconciled:** `src/app/global-error.tsx` **exists** (added by #72, on-brand). No work needed (an earlier audit
pass wrongly flagged it missing).

---

## 4. Proposed sequencing (each = one PR)

1. **Chunk 1 — Thread-switch & submit feedback** (A1 + A2 + A3). Highest value, all on the `#70/#72`
   multi-thread surface this lane owns. The natural next build.
2. **Chunk 2 — Skill-card pending states** (A4 + A6, optionally A5, A7, Explore normalize). Touches the stream
   hooks + card renderers.
3. **Chunk 3 — Route loading skeletons** (Theme B, P0→P1). Cohesive, low risk.
4. **Chunk 4 — Primitives/MATTE debt sweep** (Theme C). Drop-in anytime; reduces design-system drift.

> A1 alone is shippable if we want the gnarliest fix isolated. A2/A3 are small and pair naturally with it.

---

## 5. NORTH STAR — premium conversational thread (owner direction, 2026-06-27)

Owner reframe: this isn't loading polish, it's making the thread **feel like a premium high-end tool
(Perplexity / Claude / ChatGPT).** Two upgrades sit ABOVE the A-fixes; the A-fixes are enablers.

**Pillar 1 — premium submit→response feel (every path).** Instant "you were heard" (optimistic echo) +
a *living* working indicator (not a dead spinner) + content that *streams/reveals* rather than pops. Skills
partly do this (`ProgressChecklist`); the Read/test path does not (A3); cards pop fully-formed (A4). Match the
reference tools' rhythm: echo → thinking → progressive reveal.

**Pillar 2 — the thread is a CONVERSATION, not a card dump (text → cards → text).** Today a skill returns
bare output cards. Target: every assistant turn = an **intro line** (voice: "Here are 5 hooks for your
[audience] — the top one lands because…") → **the cards** (rich embedded artifacts) → an **outro / next-step
line** that continues the dialogue (forward-chain suggestion, already encoded in card actions). Cards become
artifacts inside a message, like a Claude reply with a table — not the whole message.

**The architectural fork — source of the conversational prose (OPEN, owner deciding):**
- **Client-templated** (deterministic strings from skill + audience + result data): instant, $0, fully in
  `lane/shell`, ships now; can still typewriter/fade in to feel streamed.
- **Engine-generated** (skill LLM writes intro/synthesis): richer, but an engine/SSE change → GSI/engine
  territory, +latency/+cost, NOT a chrome-lane change.
- **Recommendation: hybrid** — templated framing now (land the conversational shape + premium feel in this
  lane fast), engine-written synthesis as a later GSI-aligned upgrade. The `ThreadAssistantTurn` /
  `SkillResultCard` wrapper is the natural seam to add intro/outro slots regardless of source.

**Process: sketch-first.** It's a feel target driven by reference tools → lock it with a throwaway HTML mock
(`.planning/sketches/`, as the skill-cards redesign did) before building. Then the A-fixes + conversational
framing fold into the sketched target.

**Sketch (iterating — `.planning/sketches/premium-thread.html`, animated; `premium-thread.png` = ref frame).**
Open in a browser; **↻ replay** top-center. Owner reactions: v1 "better, needs a lot of refinement" → v2
"way better, still a lot to refine." Direction is RIGHT; not yet final. This is the build target the A-fixes
fold into once locked.

- **v1 (2026-06-27):** full arc over 2 turns — (T1) user echo → typed intro → 2 refined hook cards → outro +
  forward-chain chips; (T2) echo → intro → stage checklist + shimmer skeleton.
- **v2 (2026-06-27) — progress state rebuilt as the hero** (owner: the latency-progress UI is what
  users watch most; must match Perplexity/Claude/Cursor). Connected **spine** with accruing checks (✓ pops,
  spine fills to next); active step **pulses** (terracotta) + a **live sub-detail that narrates real work &
  value**; **elapsed timer** + breathing spark; on finish **collapses to "Generated in 0:32 ▸"**
  (Claude/Cursor pattern) → result **card streams in** → outro continues. Smoothness: eased reveals
  (rise+scale), cards one-by-one, intro/outro **word-fade** (blur→sharp), spine-fill + check-pop per completion.
- **v3 (2026-06-28) — cleared most of the backlog; verified rendering via Playwright (4 frames).**
  Adds: **lens-open** ("See the room →" expands inline into the 10-reactor VerbatimWall — stopped/scrolled
  split, named archetypes, "Ask the skeptic why →"; click any proof OR the replay auto-opens #1); **real
  reactor avatars** (distinct warm-neutral faces w/ archetype initials S/V/A/B, no accent — dosage stays
  on live/active only); a **pure text/chat turn** (Turn 3, flush-left Numen prose, no card — proves text
  coexists); a static **reference gallery** below the live arc with the **error/partial-failure** state
  (finished steps stay ✓, failed step marked, draft preserved, **Retry scoring →** offered) and **per-skill
  step copy** (Hooks / Script / Remix / Account Read each with their 4 stages + value-narrating sub-detail);
  **sub-detail copy** rewritten to narrate real work + value ("Re-reading what stopped them last time…",
  "Holding it to your 8/10 baseline…"); **motion** — slower word-fade, single debounced scroll
  choreography, compressed elapsed (0:00→0:32 so the timer matches the summary).
- **v3.1 (2026-06-28) — re-copied to the honest FLOOR; the buildable copy layer.**
  Grounded against the real data surfaces (`.planning/premium-thread-copy-floor.md`). Outcome of the
  client-vs-engine prose test: **~90% of the shape ships in-lane with zero fabrication.** Changes: hooks
  **intro → thin orientation** (no scores cited pre-card; script-intro already honest = cites input hook);
  **outro = the engine's real `followupText`** (restyle only, removed fabricated "beats your last opener");
  **progress sub-detail → static honest descriptor** per stage (killed the faked "Reactor 6 of 10" counter;
  live variant is a **filed engine ask** — add `detail` to the stage SSE event); script proof → "8/10
  stopped · opener" (dropped the unbacked "held to 0:04"); **lens is read-only** (living "ask them why" =
  P9/aspirational, Save lives in the card bar — matches sibling `all-skill-cards-refined.html`). Owner
  decisions LOCKED: intro = thin orientation · sub-detail = static now + engine ask filed.
- **v3.2 (2026-06-28, current) — added the Chunk-1 loading MECHANICS the copy sits on; verified-rendering
  (console clean, both new states captured).** This is now the full build target.
  - **A4 — unscored → scored.** Hook cards stream in with the proof unit **pending** (a matte-shimmer
    “Scoring with your 10 reactors…” strip where the band/ribbon will be; the scroll-quote ships with the
    card so it’s already shown), then the band + “8/10 stopped” + ribbon **resolve in** (ribbon scaleX
    0→1). Mirrors the real stream: `band ?? 'Mixed'`/`fraction ?? '–'` until the `score` event sets
    `scored:true` (`use-hooks-stream.ts` `toBlocks`). No more silent rewrite.
  - **A1 — thread-switch.** A mini sidebar+main demo (“▶ play switch”): the clicked row goes **pending**
    (A2: terracotta left-border + dim-pulse), the thread **shell stays mounted**, and a
    `ThreadLoadingSkeleton` (constellation + matte-shimmer block + “Opening thread…”) fills the scroll
    until content lands — **never** the centered serif welcome-hero. Note carries the load-bearing
    `activateThread`-await constraint (cover the gap, don’t remove it).

**Sketch refinement backlog (remaining — pending owner review of v3.2):**
- Motion-timing fine-tune pass — owner to react to v3.1 pacing (stage dwell, lens-open dwell in replay, the
  Turn-2→Turn-3 hand-off); "smoothness can be improved everywhere" is the standing bar.
- Error state is static reference — decide if it needs a live retry animation in-thread.
- (then) owner sign-off → build spec → Chunk 1.

**Resolved by the copy-floor pass (`premium-thread-copy-floor.md`, 2026-06-28):** sub-detail copy (static
descriptor decision) · lens-open depth ("ask them why" = read-only/P9, Save now) · the client-vs-engine
prose fork (hybrid confirmed: outro+stages already real, intro thin, one filed engine ask for live detail).

**Constraints carried in:** prose = **client-templated now** (hybrid; engine synthesis later) → stays in
`lane/shell`, no engine work. Terracotta dosage = active/live states only; primary action = cream, never
accent. Reuse `<Skeleton>` + refine `ProgressChecklist`; cards = locked `hook-card-refined`, untouched.

**Scope note:** presentation refinement of `thread/**` is in-lane (GSI adds *new* card types, hasn't diverged
these files — see `ui-skill-cards.md`). Keep it client-side to stay in-lane; engine prose would need the
engine team.
