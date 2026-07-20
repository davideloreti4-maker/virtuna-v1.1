# HANDOFF — THE STREAM: phase 1 + 1.5 shipped, rev 8 card-language pivot, refinement MID-FLIGHT

> **Date:** 2026-07-20 · **From:** the build session (worktree `~/virtuna-thread-cards`, branch
> `feat/thread-cards`) · **For:** a fresh session. ⚠️ **The owner is NOT satisfied with the UI yet**
> — refinement is mid-flight, they were reviewing the rev 8 gallery when this session hit context.
> Previous handoff (concept phase): `HANDOFF-2026-07-20-thread-stream-concept.md` — still valid
> background; THIS file is the current state.

## 0. Where things stand (one paragraph)

The stream architecture is BUILT and green: `composed` block type (17-primitive closed vocabulary,
zod laws, ONE renderer family), THREAD-04 intact, ad-hoc composer proven (20/20 first-try valid,
zero fabrications). The design went through owner rounds ending in **rev 8 — THE PIVOT: structured
result groups render as CARDS in the make-family language** (the owner showed the old idea-card +
Reading screenshots and said keep those concepts; the one-frame law was an over-correction — the
audit's real finding was 3 languages + 17 renderers, never "frames bad"; the old thread already WAS
prose-between-cards). The owner's last word: "we're not finished yet."

## 1. Commits this session (all on `feat/thread-cards`, pushed)

- `c46ef133` sketch rev 7 — vocabulary closed at 16 (+stat line, +table, multi-slot input ask)
- `e2386eaf` **phase 1** — `composed` block: schemas + laws-as-refines + one renderer + fixture + /dev/cards
- `6e98e330` **phase 1.5** — composer spike: qwen3.7-plus, 20/20 schema-valid FIRST TRY, zero fabricated numbers
- `3fffd3fd` refinement 1 — video reference gets receipt-grade treatment (covers, sourceProof, facets)
- `b266379d` refinement 2 — bigger covers (72px rows / 176px tiles), engagement stats, ranked anatomy, spacing
- `0d5db9b1` **rev 8** — card language + `test-verdict` primitive (17); renderer split to 3-file family

## 2. The load-bearing decisions (do not re-litigate)

1. **Rev 8 card language:** ranked results / asset / test-verdict = make-family CARDS built by
   IMPORTING the shipped primitives (`CardEyebrow` · `ProofReceipt` · `ProofUnit` · `CaretToggle` ·
   `CardActionBar`) — pixel-identical to the bar BY CONSTRUCTION. Light primitives (prose · receipt
   line · stats · table · facts · plan · compare · revision · proof · verbatim · input-ask ·
   persona-turn) stay open between cards.
2. **`sourceProof` IS `HookProofSchema`** (imported, not mirrored) → renders the shipped
   `<ProofReceipt>`. One schema, one component, zero drift.
3. **`test-verdict` = THE FLAGSHIP'S primitive**: 1:1 the shipped video-test-card props
   (`VideoTestCardBlockSchema.shape.props`), delegated to `VideoTestCardRenderer`. Bands only
   in-thread; the 0-100 + gauge stay on `/analyze` (the full Reading page is its own surface,
   reached via "See the full breakdown →" — NOT a stream rewrite target until phase 6).
4. **Laws as schema refines** (each has a must-fail test): receipt leads (index 0 only) · ≤1 asset ·
   ≤1 input-ask · table rows match columns · ≤1 accent cell · ≤1 warn stat.
5. **Extension guarantee** (the flexibility answer, owner-locked): primitive #18 = one schema + one
   renderer case (exhaustive `never` breaks the build) + one fixture item (kind-coverage test fails
   without it). Deferred with tripwires: `chart`, `timeline`. Plus phase-5 gap telemetry (composer
   logs shapes it wanted and lacked).
6. **Grammar contract ≠ data contract:** per-skill data fidelity is nailed in /dev/cards
   old-vs-new side-by-sides, each gated on owner approval before the old renderer dies.
7. `primaryAction` on ranked items is a LABEL; handlers wire at migration — never model-executed.

## 3. The files

- `src/lib/tools/stream-primitives.ts` — the 17 schemas + laws + `STREAM_PRIMITIVE_KINDS`
- `src/components/thread/composed-block.tsx` (dispatch + light views) ·
  `composed-cards.tsx` (card language) · `composed-shared.tsx` (fragments) — split for the 500-line rule
- `src/lib/tools/__tests__/fixtures/stream-composition.ts` — THE canonical all-17 fixture
  (self-contained SVG data-URI covers — picsum rate-limits under repeated shots; never external URLs here)
- Tests: `src/lib/tools/__tests__/stream-primitives.test.ts` (laws must-fail + kind coverage) ·
  `src/components/thread/__tests__/composed-block.test.tsx` (render lock via real MessageBlocks)
- `scripts/composer-spike.mts` — re-runnable spike (`node --experimental-strip-types …`)
- `src/app/(app)/dev/cards/` — sections `composed` (canonical) + `composed--spike` (20 live compositions)
- Contract: `docs/prototypes/stream-concept-rev8.html` + same artifact URL
  (https://claude.ai/code/artifact/bb5b3854-97b3-43fb-baed-3b2d022f0a39). **The /dev/cards
  "Stream (composed)" section is the visual SSOT** — it renders shipped components and cannot drift.

## 4. OPEN — what the fresh session continues

1. **Owner review of rev 8 pending.** They pivoted the direction and hadn't seen the result when the
   session ended. Start by asking them to look at /dev/cards → "Stream (composed)". Expect more
   refinement rounds — the standing bar: "premium, polished, billion-dollar company"; thumbnails
   big and prominent; NO information the old cards had may go missing.
2. **Keep diffing old renderers field-by-field** each round — owner twice found missing data
   (engagement stats, mechanism/anatomy, kicker). Old sources of truth: `hook-card-block.tsx`,
   `idea-card-block.tsx`, `script-card-block.tsx`, `remix-card-block.tsx`, `account-read-block.tsx`,
   `outlier-tile.tsx`/`video-card.tsx`, `video-test-card-block.tsx`, `multi-audience-read-block.tsx`.
   Not yet audited against the stream: account-read's profile-line/accuracy row, remix decode
   detail, multi-audience-read's who-not-for + persona drill.
3. **Spike content is "not accurate at all" (owner)** — thin simulated contexts, NOT a schema
   problem. Re-run `scripts/composer-spike.mts` with production-shaped contexts + the new card
   fields (sourceProof numbers, engagement, details, primaryAction) so the spike gallery matches
   product density. Also carry the spike's phase-5 prompt findings: bands ONLY from context
   reactions (model inferred them from multipliers) · verbatim speaker must be a context persona ·
   `table` never chosen · persona-turn framed as verbatim.
4. **Then the phase plan** (owner-gated): phase 2 hooks parity (old vs new side-by-side in
   /dev/cards, owner approves per skill) → 3–4 migrations → 5 ad-hoc composer prod (+ gap
   telemetry) → 6 Reading page → 7 retire the 17 renderers.
5. Small: `.scratch/stream-sketch.html` copy is stale (rev 7); dev-server row for this lane still
   missing from the worktree table in `CLAUDE.md`.

## 5. Environment (all verified this session)

- Dev server: `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev
  -p 3000 --turbopack`, detached via python fork+setsid; it DIES between long commands — probe
  `lsof -ti :3000` before shooting; kill with `lsof -ti :3000 | xargs kill -9`.
- Shots: `SECTIONS=composed node .scratch/shoot.mjs` (login e2e-test@virtuna.local /
  e2e-test-password-2026); `MOBILE=composed` for 390px. Full-page shots hide detail — clip per scene.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (never `npm test`). tsc via `npx tsc --noEmit`.
- Suite green at handoff: 392 files / 4300+ tests, tsc 0. Memory SSOT:
  `thread-cards-grammar-rework.md` (write via Bash heredoc — path-guard blocks Write outside worktree).
