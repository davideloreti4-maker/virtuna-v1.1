# HANDOFF 2026-08-21 — Chat parity with Claude/ChatGPT: execution plan

**Branch:** `lane/chat-parity` (docs only). Execution sessions branch from `origin/main` — always
`git fetch` + `git rev-parse origin/main` first; co-sessions move refs.
**Worktree note:** a new worktree needs its own `npm install` and its own `.env.local` (copy from
trunk BEFORE any `worktree remove` — removal deletes gitignored files).

**Source:** full audit session 2026-08-21 (three deep code sweeps: chat surface inventory, agent
loop/Qwen internals, grounding/latency). Every claim below carries file:line from that audit —
re-verify lines before editing; main moves.

## Owner rulings captured this session

1. **Money is unlocked.** "Everything can be turned on" — live scraping, cron scheduling,
   background execution, model spend. See the Apify blocker below before flipping anything.
2. **Onboarding interview is ruled outdated** — and the audit found it was already deleted
   (PR #502, 2026-08-14); today's funnel is already handle-first. The real gap is the missing
   scrape→profile write-back.
3. **The `/welcome` blocking wall dies (ruled this session).** The owner endorsed the S3 target
   shape from `docs/ONBOARDING-FUNNEL-DESIGN.md`: signup lands in `/home` in seconds, the handle is
   asked inline, calibration runs in the background, the audience ARRIVES as an event in the
   thread. Lane 9 is structured as Phase A (now) / Phase B (after the Lane 8 background primitive).
4. **Design language (co-session ruling, same day):** the owner ruled to adopt Claude's design
   language wholesale — the "de-Claude" differentiation doctrine is REVERSED. Spec:
   `docs/HANDOFF-2026-08-21-claude-design-adoption.md` (on its own branch, not on main yet).
   **Do not restyle surfaces inside these lanes** — build function here, follow the adoption
   handoff for look-and-feel, and expect its merge to move visual ground under you mid-lane.

### 🔴 Blocker on the money ruling: Apify account

Apify runs on rotating FREE accounts with a **$5/month hard cap**
(memory: `apify-free-plan-hard-limit`). Live sourcing costs ~$0.11/send verified — the cap dies in
~45 sends, and a cap-out masquerades as "check your handle is public". **"Everything on" requires a
paid Apify account first.** That is the one purchase gating Lanes 7 and 8. Confirm with the owner
which account/plan before scheduling any scrape cron.

### Standing verification norms (do not relax)

- tsc + `npm run build` + tests BEFORE push. A green Vercel check is NOT a build.
- 🔴 Deploy state: memory `vercel-git-disconnected` says auto-deploy is OWNER-CONFIRMED OFF and
  `numenmachines.com` 404s by design — **never make "watch it in production" a success criterion**;
  probe the running app only if the owner confirms a deploy.
- UI changes: verify in a real browser (Playwright: `animations: 'disabled'`, native viewport per
  device — resizing a loaded page is not the mobile UI). Suite flakes 0–7 tests under full load
  (memory: `suite-flakes-scraping-omni`) — ask whether a failing test can reach your diff.
- dev and prod share ONE Supabase project. `supabase db push` is UNSAFE (ledger drift) — single
  migrations via SQL editor / `apply_migration`.

---

## The audit in one table

| Dimension | vs Claude/ChatGPT | Verdict |
|---|---|---|
| Loading states (progress spine, evidence rail) | AHEAD | keep; 2 blind spots (Lane 5) |
| Grounding honesty (warrant, citable subset, banding) | AHEAD | keep |
| UI design system | ruled: adopt Claude's language wholesale | separate lane (see ruling 4) |
| TTFT (5.28s prose / 4.04s skill measured) | BEHIND | ~2s self-inflicted → Lane 1 |
| Message ops (regenerate/edit/copy/thumbs/search) | BEHIND | Lane 6 |
| Context (20-turn hard window, no compaction) | BEHIND | Lane 4 |
| Memory (no library/cross-thread/auto-extraction) | BEHIND | Lanes 2+3 |
| Freshness (ageless corpus, no web) | ABSENT | Lane 7 |
| Bigger tasks (background/scheduled/resumable) | ABSENT | Lane 8 |
| Onboarding (scrape→profile write-back MISSING) | broken data loop | Lane 9 |

Key figures an executor should not re-derive:
- TTFT decomposition (probe `scripts/probe-f11-stream-timing.ts`, N=4/shape, docs/NEXT-SESSION-2026-08-17.md §2b):
  prose 5.28s thinking-ON vs 3.14s OFF; skill 4.04s vs 2.35s. ~2s = `enable_thinking`
  (`chat-agent-loop.ts:1166`, quality-load-bearing — composition 6/6→2-4/6 without it; keep ON),
  ~3s provider baseline vs the 25,268-char system prompt, ~1.5–2s sequential pre-stream work.
- Loop bounds: `DEFAULT_MAX_ROUNDS=4` / `COMPOSING_MAX_ROUNDS=6`, `DEFAULT_MAX_SKILL_RUNS=2`,
  `MAX_CORPUS_SEARCHES_PER_TURN=3`, `max_tokens` 2000/4000 (`src/lib/tools/chat-agent-loop.ts:429-447`).
- Prior-turn window: `MAX_PRIOR_TURNS=20`, silent slice (`src/lib/threads/chat-prior-turns.ts:44`).
- Corpus: 532 rows (63% IG / 33% TikTok / 4% YT), `posted_at` populated on 532/532 and read by
  NOTHING; `proof_captured_at` NULL on all curated rows so the 90-day freshness gate is a no-op.
- Prod profile coverage (2026-08-10): 18 profiles, 3 saw the interview, 2 have niche/goal/style,
  0 have past_wins/pain_points. Auto-derived beats self-reported: 6/13 audiences carry a
  scrape-derived `creator_persona` vs 2/18 profiles carrying anything.

---

## Lane 1 — TTFT sequencing (free ~1.5–2s, zero product trade)

**Files:** `src/app/api/tools/chat/route.ts:300-473`.

Today, strictly sequential before the first SSE frame: auth → csrf → rateLimit (Upstash RT) →
`request.json()` → `creator_profiles` select → open-thread resolve → `resolveThreadAudience`
(2 selects) → `loadMessages` (select *, **no limit**) → `insertMessage` (user turn) →
`setThreadTitleIfEmpty` (select+update) → stream constructed.

Changes:
1. `Promise.all` the independent reads: profile ∥ thread-resolve, then audience ∥ loadMessages.
2. Move the two writes (`insertMessage`, `setThreadTitleIfEmpty`) past first token — the loop never
   reads them (`priorTurns` comes from `loadMessages`; the current ask is passed as `currentAsk`).
   Keep write-failure handling: if the user-turn insert fails after streaming began, persist at turn
   end with the assistant turn (same transaction) and surface a warning frame — never lose the turn.
3. Add `export const maxDuration = 300` to `/api/tools/chat` (it has NONE today; its skills assume
   a 300s budget — `skill-capabilities.ts:10-11` documents the mismatch). Same for the four heavy
   generator routes (`hooks`, `ideas`, `script`, `explore`) which also export none.
4. Provider resilience: chat client is `maxRetries: 0`, no fallback (`src/lib/engine/qwen/client.ts:15`)
   — one DashScope hiccup = user-facing error. Add one retry with short backoff on the FIRST
   completion call of a turn only (never mid-stream), preserving the cached prefix (retry nudges on
   user message, per `engine/remix/adapt.ts` pattern).

**Verify:** re-run `scripts/probe-f11-stream-timing.ts` (N≥4/shape) before/after; assert user turn +
assistant turn both persisted on happy path, abort path, and insert-failure path. tsc + suite.

## Lane 2 — Library visibility (`search_library` tool)

**Gap:** the model cannot see `saved_items`/`library_projects` — no tool, no bundle field. A saved
hook in a new thread is invisible. `match_personal_teardowns` RPC exists with NO producer
(`src/lib/grounding/retrieve.ts:16-18`).

Build: a free, read-only `search_library` tool bound alongside `search_corpus`
(registry: one `SkillTool` in `src/lib/tools/skill-dispatch.ts:217` shape `{name, skillKey,
billable?, schema, run}`; free tools follow the `search_corpus` pattern in
`src/lib/grounding/corpus-tool.ts`). Start with structured filters (type, recency, text ILIKE) over
`saved_items` — embeddings later only if recall proves weak. Return compact JSON rows + emit a small
UI receipt block (mirror `corpus-references` restraint: no block when 0 rows). Reuse the search
budget/withdrawal pattern (`src/lib/grounding/search-budget.ts`), shared or parallel governor.
Update `toolUseDirective` so the tool is named only when bound (`chat-agent-loop.ts:475-578`).

**Verify:** live thread — save a hook, new thread, "what did I save about X?" → correct row cited.
Sealed visitors must NOT get the tool (they have no library).

## Lane 3 — Memory: conversation → profile auto-extraction

**Gap:** chat never writes anything back; profile is empty for 16/18 users; every "add X to the
bundle" proposal dies on null columns (memory: `profile-columns-are-mostly-empty`).

Shape (ChatGPT-memories analog, adapted):
1. Post-turn extraction pass at turn persistence (NOT in the token path — zero TTFT cost): a cheap
   flash call over the user's turns of this thread, extracting ONLY facts that map to existing
   `creator_profiles` columns via `PROFILE_ROLE_MAP` roles (niche, audience, goals, platform, wins,
   flops, voice). No free-text memory store in v1 — fill the columns the bundle already reads.
2. Confidence + provenance: write only explicit self-statements ("I make cooking videos"), never
   inferences from questions. Store `{value, source: "chat", captured_at}`; never overwrite an
   interview/self-edited value with an extracted one without a receipt.
3. Receipt UX: a quiet one-line block under the turn — "Noted: niche → cooking. Edit in profile." —
   with undo. User-editable via the existing `profile-settings-form.tsx`.
4. Respect the corollary: prefer computed over asked — where a connected account exists, scrape-derived
   fields (Lane 9) outrank chat-extracted ones.

**Traps:** Supabase writes swallow CHECK failures silently — read the real CHECKs before any upsert
(memory: `supabase-check-constraints-fail-silently`). Coverage-count prod before/after; the win
condition is measured non-null coverage climbing, not a green suite.

## Lane 4 — Context: compaction + audience in the chat bundle

1. **Compaction:** when turns fall off the 20-turn window (`chat-prior-turns.ts:158`), fold them
   into a rolling thread summary persisted on `threads` (write at turn boundaries, same place as
   Lane 3's pass); prepend as one system-adjacent app note. Keep the summary out of the byte-stable
   system prefix (cache contract, `src/lib/kc/compiled.ts:1-10`) — it rides the user/bundle tier.
   Card lines stay OUT (they were evicted from the digest for copy-safety; keep that).
2. **Audience:** `resolveThreadAudience` result reaches skill runs but never the chat bundle —
   `assembleBundle` call at `route.ts:579-582` passes only `{ask, platform, mode, modeLabel}`. Add
   an audience role to `MODE_ROLES.chat` (currently `niche, audience, platform` — verify what
   `audience` maps to vs the thread's pinned audience) so the chat prompt knows who it's aiming at.
3. Do NOT just raise `MAX_PRIOR_TURNS` — compaction first; raising the window alone inflates the
   volatile tier and slows TTFT.

**Verify:** long-thread probe — 30+ turn thread, reference a fact from turn 2, answer must hold it.
Measure bundle size stays ≤ `BUNDLE_CHAR_CAP` shed behavior (`kc/assembler.ts:500-598`).

## Lane 5 — Interactive affordances: choice chips + search visibility

1. **`choices` variant of `request_input`** (`chat-agent-loop.ts:66-104`,
   `src/components/thread/input-request-block.tsx`): model supplies option VALUES only (2–4 short
   strings + optional "why" per option); chrome, copy, and layout stay registry-owned — the "no
   model-generated UI" policy survives. Selecting an option posts it as a user turn (same path as
   follow-up chips, `composer.tsx:1634-1651`). Cap value length; sanitize like `sanitizeCards`
   (strings only, junk → drop). Idempotence via the existing `shownInputFields` set.
2. **Model-authored follow-up text:** `chat-followups.ts` is a static registry (2–3 chips per turn
   kind). Allow the model to propose chip TEXT inside the fixed chip chrome (same sanitize rules),
   falling back to the registry when absent/invalid.
3. **Search visibility:** chat's own `search_corpus` emits no stage/evidence — a grounded prose turn
   goes silent ~10s per search round. Emit a `stage` frame ("Searching the corpus — 'query'…") on
   tool start/end from the loop (`chat-agent-loop.ts:1268-1294`), and reuse the evidence honesty
   rules (`src/lib/tools/evidence.ts:14-25` — input claims only, never result claims).

**Verify:** browser. Chips render, tap sends, second identical request_input suppressed. Screenshot.

## Lane 6 — Table-stakes message ops (one batch PR, or two)

- **Regenerate** on a successful assistant turn (today Retry exists only on failure,
  `run-notices.tsx:50-57`). Re-send the same ask; mark the old turn superseded (keep it — no
  destructive delete without ruling).
- **Edit a sent user message** + re-run from there (ChatGPT's main correction path).
- **Copy on prose turns** — `CopyAffordance` (`card-primitives.tsx:134`) exists for cards; add to
  `markdown-block` turns.
- **Thumbs up/down per assistant turn** — persist to a small table keyed
  `{message_id, user_id, verdict}`; this seeds the dead outcome loop (`reconciliations` = 0 rows
  forever, memory: `outcome-loop-has-never-closed`). No UI dashboards yet; just bank the signal.
- **Full-text thread search** — ⌘K palette searches titles only (`CommandPalette.tsx`,
  `app-shell.tsx:77-96`). Supabase FTS (tsvector on messages content) + palette section.
- **Composed-card action bar** — ships `disabled`/unwired (`composed-card-block.tsx:56-62`). Wire it
  or hide it; a visible dead control is worse than absence.
- Stretch: partial-stream persistence (persist assistant content at round boundaries so a mid-turn
  server throw doesn't lose the whole answer; today nothing persists until turn end and there's no
  `cancel()` on the ReadableStream — `route.ts:459`); LLM thread titles (today write-once heuristic).

**Verify:** each op in a real browser on a real thread; FTS via API probe; suite.

## Lane 7 — Freshness (money ruled ON; Apify blocker above applies)

1. **Use `posted_at`:** add recency to ranking (`src/lib/grounding/rank.ts:89-122` round-robin —
   recency as a within-archetype tiebreak ahead of similarity for topical axis; do NOT let it
   nuke structural retrieval where "structure never rots" is the documented stance) and surface age
   on reference cards (`corpus-references-block.tsx`) — "May 2026" chip. Cheap, honest, immediate.
2. **`LIVE_SCRAPE_DEFAULT=true`** (env; strict `=== "true"` — `scrape-default.ts:42-48`) once the
   paid Apify account exists. Note #517 made authorized runs scrape-FIRST (cache is the net behind,
   `gather-for-run.ts:423`) — so this flag turns ~every generator send into ~$0.11. Env vars are
   write-only `sensitive` on Vercel and need a REDEPLOY; probe the running app after.
3. **Fix the limit lie:** tool advertises `limit` 1–12 (`corpus-tool.ts:42`) but retrieval caps at
   `maxExamples: 6` (`retrieve.ts:102,435-438`). Align the advertised max to the real one (6) —
   fix the claim, not the threshold, unless the owner wants more rows.
4. **Platform correctness:** `PLATFORM="tiktok"` hardcoded but never reaches resolution; corpus is
   63% Instagram — derive platform from the source URL (memory: `corpus-is-majority-instagram`).
5. **Web search in chat:** still ABSENT and the largest capability gap. Scope as its own future lane
   (provider choice, honesty rules for web rows vs corpus rows). Do not bolt on inside this one.

## Lane 8 — Bigger tasks: background execution (money ruled ON)

Today: nothing survives the SSE request — no `waitUntil`, no job/queue table (0 of ~55 tables), no
resumable runs. 11 cron route dirs exist, only 3 scheduled in `vercel.json`; the 8 unscheduled
(`audience-drift`, `calculate-trends`, `refresh-account-snapshots`, `refresh-competitors`,
`refresh-corpus`, `scrape-trending`, `reap-anonymous`, `validate-rules`) are written and auth-gated
— they were unscheduled as deliberate cost control, which the owner has now lifted (Apify blocker
permitting).

Order of attack — **8a is a dependency of Lanes 3, 4, and 9-B; do it first:**
1. **8a — the background primitive.** Smallest viable = Vercel `waitUntil` for post-response work.
   Three consumers already queued: Lane 3's extraction pass, Lane 4's compaction write, and Lane
   9-B's background calibration. Build it once as a small helper (`runAfterResponse(fn)` with
   error logging — a swallowed background failure is invisible by construction, so log loudly).
   A background job also needs a way to SURFACE: the v1 delivery mechanism is "insert a
   message/block row on completion + client refetch on focus/poll" — no websockets, no new infra.
2. **8b — schedule the no-spend crons:** `reap-anonymous`, `validate-rules`, `calculate-trends`.
   Watch logs a full cycle before adding more.
3. **8c — scrape crons** after the paid Apify account: `refresh-account-snapshots`,
   `audience-drift`, `refresh-corpus`, `scrape-trending`, `refresh-competitors`. Price each per run
   BEFORE scheduling (memory: `price-a-fix-before-deferring`) and cap frequency accordingly.
   ⚠️ Do NOT touch `delete-retained-videos` — the video-retention cron has NEVER worked (missing FK;
   its green tests mock the FK graph — memory: `video-retention-cron-never-worked`). Separate fix.
4. **8d — job table / resumable runs:** bigger design, changes product shape ("watch my account",
   deep-research runs). Brainstorm separately before building; nothing in Lanes 1–9 needs it.

## Lane 9 — Onboarding: close the write-back loop (the interview is already dead)

**Corrected picture (audited 2026-08-21).** The 9-card interview modal was **deleted 2026-08-14
(PR #502)** — it had been unreachable since `/analyze` became a redirect (that's the whole "3 of 18,
nothing since 2026-05-31" stat). The card pickers survive only as the flat `/settings` profile form
(`profile-settings-form.tsx`). The onboarding a new account actually gets today is already the
handle-first shape:

`/signup` → middleware-gated `/welcome` → step 1 handle **or** description (`connect-step.tsx`;
no skip) → ~2 min calibration scrape (110–209s measured, blocking, not resumable mid-scrape) with
**3 optional questions rendered during the wait** (`wait-questions.tsx`: `primary_goal`,
`creator_stage`, `pain_points` — auto-save on tap, no submit button) → `/home` first-run
(one teaching sentence + show-once demo). Every calibration exit completes onboarding.

**🔴 The defect that matters — the scrape writes NOTHING to `creator_profiles`.** Calibration output
lands in `audiences.creator_persona` / `connected_accounts` / `account_snapshots`, while
`niche_primary`, `target_platforms`, `content_style`, `past_wins` stay NULL for every scraped
account. `HANDOFF-2026-08-15-three-orphans.md:33` claims "niche, platforms and past wins/flops all
fall out of the account read" — true of the DATA, never implemented as a WRITE. This is why chat
grounding sees an empty profile even for users who completed the new onboarding, and it is the
cheapest possible fix to the "empty profile" problem: **zero added friction, pure plumbing.**

**Ruled this session: the `/welcome` wall dies (S3 end-state).** The current flow charges its
highest toll (a 110–209s blocking, non-resumable wait) at the moment of lowest trust — before the
user has seen any product — and then doesn't even collect the reward (no write-back). Two phases:

### Phase A — now, no dependencies

1. **Write-back:** after `calibrateFromScrape`, populate `creator_profiles` from scrape output —
   `niche_primary`/`niche_sub` (from `creator_persona.content_description` / `nicheQuery`),
   `target_platforms` (connect door's platform), `content_style` (`format_signature`/`formatMix`),
   `past_wins` (top `analyzedVideos` by views). Never overwrite a non-null self-edited value.
   Read the real CHECK constraints first (writes swallow errors silently). This ships regardless of
   Phase B — the same write-back runs wherever calibration runs.
2. **Fix obs 2** — "Good afternoon," with no name (`home-greeting.tsx` expects a name a new account
   never gave). Straight bug.
3. **Unify `isColdStart`:** three near-copies; `assembler.ts:377-387` added `hasVoice` against the
   "MIRRORS EXACTLY / do NOT modify independently" contract in `chat-runner.ts:159`. Inert today
   (`writing_voice_description` isn't even a column), but a live contradiction. One predicate,
   one home.
4. **Prune dead intake from `/settings`:** `cuts_per_second`, `reference_creators`,
   `posting_frequency`, `time_of_day_aware` feed only the video-analyze pipeline
   (`engine/creator.ts:262`). Label the section honestly ("video analysis settings") or drop the
   fields. `pain_points` stays — roadmap signal by explicit ruling, deliberately NOT engine
   grounding (`wait-questions.tsx:28-30`).
5. **Platform:** `connect-step.tsx:115` hardcodes `platform: "tiktok"`; corpus is 63% Instagram —
   open the door enum (ties to Lane 7 item 4).

### Phase B — after Lane 8a: kill the wall

1. **Signup → `/home` immediately.** Drop the middleware `/welcome` bounce
   (`middleware.ts:173-188`); `onboarding_completed_at` stamps at signup (keep the column — other
   code reads it).
2. **Handle asked inline:** one skippable first-run card above the composer (handle OR describe —
   keep both doors). Chat is usable before/without it; cold-profile copy already handles this.
3. **Calibration runs in the background** via the 8a primitive when the handle lands. NOTE: today
   calibration does all its work inside the `/welcome` SSE stream and a killed page still spends
   the Apify run — moving it behind `waitUntil` makes the spend deliberate instead of fragile.
4. **The audience ARRIVES as an event:** on completion, insert the arrival block into the thread
   ("Your 10 people are ready — built from @handle") + client refetch. Same job as today's wall,
   opposite emotion. Scrape failure/thin account also arrives as an honest event with a retry
   affordance — never a silent nothing.
5. **Goal/stage become a chip row on first-run** (replacing the wait questions' home), and the
   cold-start nudge finally gets its consumer here: nudge ONLY when a needed field is null AND
   would change the next run — or delete the dead signal (`coldStart` is computed, streamed,
   parsed, made sticky in `use-chat-stream.ts:287-293`, and consumed by NOTHING; the documented
   consumer `ChatThreadView` is a dev-page stub).
6. **Obs 6 (the one-sentence teaching moment) is folded into the first-run design** — the empty
   states and the arrival event ARE the teaching surface. Obs 1 (card in a desktop void) dies with
   the page.
7. **Coverage-gate the goals role:** once write-back + Lane 3 raise coverage, re-count prod and
   consider adding `goals` to more `MODE_ROLES` — a previous attempt died on 16/18-null coverage;
   data first, roles second.

Constraints that survive the rewrite: obs 3/4/5 are settled COPY constraints; the five 🔒 locked
calls in `docs/HANDOFF-2026-08-04-onboarding-ui-refinement.md` stand (onboarding IS the first run —
no tour, no demo screens; first card funded by entitlement; marketing CTAs → `/go`). The `/go`
anonymous funnel and `claim-account.ts` are untouched by Phase B — verify their exemptions still
hold after the middleware change.

---

## Sequencing & dependencies

Recommended order: **1 → 8a → 9-A → 2 → 3+4 → 9-B → 5 → 6 → 7** (8b/8c/8d interleave as the
Apify account allows).

- Lane 1 first — everything after gets measured against a faster baseline.
- **8a (waitUntil primitive) unblocks three lanes** — 3's extraction, 4's compaction, 9-B's
  background calibration. Build it before any of them.
- **3 and 4 share one post-turn pipeline** (extract + compact in the same turn-boundary pass) —
  build the hook once, in whichever lane runs first, and the other extends it.
- 9-A is independent and ships now; 9-B waits only on 8a.
- Lanes 2, 5, 6 are independent — slot anywhere, good parallel-session candidates.
- Lane 7 items 1/3/4 are independent code fixes; item 2 waits on the paid Apify account.
- **Worktree discipline:** the next session continues in its own worktree of main —
  `~/virtuna-chat-parity` (branch `lane/chat-parity`, tracks `origin/main`) is that worktree; run
  `npm install` and copy `.env.local` from trunk before any dev server. Per-lane execution
  branches: `git fetch` then branch from `origin/main` inside this worktree (`git switch -c`).
  Parallel sessions take their own sibling worktrees instead. One dev server per port
  (`lsof -ti:3000`). Suite flake families per memory before blaming a diff.

## Copy-paste kickoff prompts

Lane 1 — TTFT:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 1. New worktree + branch off
> origin/main. Parallelize the pre-stream reads and defer the two writes past first token in
> src/app/api/tools/chat/route.ts; add maxDuration to the chat + generator routes; add one
> first-call retry to the Qwen client path. Prove with scripts/probe-f11-stream-timing.ts
> before/after (N≥4 per shape) and the persistence tests. tsc + build + suite before push.

Lane 2 — Library tool:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 2. New worktree + branch. Add a free
> read-only search_library tool over saved_items following the search_corpus/search-budget
> patterns; compact JSON to the model, receipt block to the UI, no block on 0 rows, absent for
> sealed visitors. Live-verify: save a hook, new thread, ask for it.

Lane 3 — Memory extraction:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 3. Brainstorm the extraction contract
> first (columns, confidence, receipts, undo), then build the turn-boundary pass + receipt block.
> Read the real CHECK constraints before any upsert. Success = prod coverage counts climbing.

Lane 4 — Compaction:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 4. Rolling thread summary at turn
> boundaries + audience role into the chat bundle. Keep the system prefix byte-stable. Long-thread
> probe is the gate.

Lane 5 — Choice chips:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 5. Add the choices variant to
> request_input (values from the model, chrome from the registry), model-authored follow-up text
> with registry fallback, and stage frames for search_corpus. Browser-verify with screenshots.

Lane 6 — Message ops batch:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 6. Regenerate, edit+rerun, copy on
> prose, thumbs (new table, no dashboard), FTS thread search, wire-or-hide the composed-card action
> bar. Browser-verify each. Split into two PRs if the diff grows.

Lane 7 — Freshness:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 7. Recency tiebreak + age chip, fix the
> limit 12→6 claim, derive platform from source URL. LIVE_SCRAPE_DEFAULT only after the paid Apify
> account is confirmed; env change needs a redeploy — probe the running app.

Lane 8 — Background:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 8. 8a first: the waitUntil
> post-response helper with loud error logging + the insert-block-on-completion delivery pattern —
> it unblocks Lanes 3, 4 and 9-B. Then 8b (three no-spend crons, watch a full cycle). 8c only
> after the Apify account; price each cron per run first. Do not touch delete-retained-videos.

Lane 9-A — Onboarding write-back (now):
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 9 Phase A + the two 2026-08-04
> onboarding handoffs. Write-back first, then the greeting-comma bug, then items 3–5. Never
> overwrite non-null self-edited values; read the CHECK constraints before upserting. Verify with
> a real signup + scrape and a prod coverage count.

Lane 9-B — Kill the /welcome wall (needs Lane 8a):
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 9 Phase B. Signup lands in /home;
> skippable inline handle card (both doors); calibration behind the 8a primitive; the audience
> arrives as a thread event (failure/thin arrives honestly too); goal/stage as a first-run chip
> row; wire or delete the cold-start nudge. Do not re-litigate obs 3/4/5 or the five LOCKED calls.
> Verify the /go funnel + claim-account exemptions still hold after the middleware change. Browser
> walk on a fresh signup, desktop + native mobile viewport.

## Explicitly out of scope this audit

Visual restyling (the Claude-design-adoption lane owns look-and-feel — ruling 4; function-only
here), mobile-specific UX (not swept), pricing/billing UX, landing/trial funnel (own lane, in
flight), a11y (lane closed 2026-08-21), voice input/TTS, thread branching, generic multimodal
composer (routed attach is the product answer), MCP (solves a problem Maven doesn't have).

## Also-noticed (small, park or fold into nearest lane)

- `delta.reasoning_content` never read in the loop (`chat-agent-loop.ts:1194-1212`) — provider
  reasoning on the proper channel is dropped silently; read-and-discard explicitly.
- Adaptive `enable_thinking`: predispatch already classifies the ask — skipping thinking on
  smalltalk/simple prose turns would cut ~2s on those turns. Needs a quality probe per shape
  (N≥6, rate not one-shot — DashScope is nondeterministic even at temperature:0).
- Model tiering: all roles resolve to `qwen3.7-flash`; the rollback-seam constants would accept a
  deeper model for script/remix now that spend is unlocked. Probe quality first.
- `composer.tsx` is 4,104 lines and owns half the chat behavior — decompose opportunistically when
  a lane touches it, not as its own project.
- Motion contract (`docs/MOTION-CONTRACT.md`) still awaits owner approve/amend before any surface
  sweep — likely subsumed by the design-adoption lane (ruling 4); check that handoff first.
