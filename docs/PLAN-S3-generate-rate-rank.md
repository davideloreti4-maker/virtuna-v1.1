# Plan — S3′: generate-rate-rank-keep (batched SIM, all skills)

> Supersedes `docs/HANDOFF-S3-batched-sim.md`. Branch `fix/s3-batched-sim` (off clean main,
> #37+#39 merged). Written 2026-06-25. The batched flash call validated in `scripts/s3-batch-spike.ts`
> (N=8 live: parses, 10 personas/candidate, independence holds; flagged latency + within-candidate
> divergence on large N → solved by generating fewer on purpose).

## 0. The shift (locked with user)

**From gate-and-cut → generate-and-rate.** Today: over-generate a buffer → SIM each candidate →
**cut Weak + trim** → user can wait ~1min and get 0–2 cards. New: generate exactly the display
count → **ONE batched SIM rates + ranks ALL** → **keep them all** (ranked, never cut) → reactions
surface in the ambient modal → **rewrite is a user-pressed action** (no auto-regen).

Why it's better *and* GSI-aligned: keep-all/rate-rank is the domain-general SIMULATE behavior
(you never silently cut the user's stimulus — you simulate the population's reaction and surface
it). The batched call IS the reusable SIMULATE primitive. `fix/s3-batched-sim` is the named
GSI-foundational spike (see memory `numen-gsi-vision`). Build the batch primitive **domain-general
in shape** (`candidates[] → reactions[]`, id-keyed); keep socials specifics (10 archetypes,
verdict stop/scroll, band math) where they already live — leave the pluggable-scoring seam clean
for the GSI milestone, don't build the DomainPack now.

## 1. Locked decisions

- **Keep all** — no Weak cut, no top-N trim. Generate count = display count.
- **Counts:** hooks **5** · ideas **4** · remix **3** (was generate-3-ship-1) · script **1** (rates opener, unchanged) · chat/explore unchanged.
- **Rewrite = user-pressed** (replaces D-06 auto-regen-on-zero; that path is removed).
- **Applies to all skills** (hooks/ideas/remix get the batched rate-rank-keep; script/chat/explore already keep their single output).
- **Batched SIM result feeds the ambient modal** (UI-lane — separate PR).

## 2. PR split (respects worktree UI HOLD)

- **PR-1 (engine, THIS lane):** batched SIM primitive + generate-rate-rank-keep (hooks/ideas/remix) + counts + each card carries its 10 personas (data available for the modal) + ENGINE_VERSION bump + steer-closure rebaseline + tests. NO auto-regen.
- **PR-2 (UI lane, coordinate):** ambient audience modal reads each card's batched personas (no new `/api/tools/react` call for generated cards).
- **PR-3 (later):** user-pressed "rewrite for audience" loop.

## 3. PR-1 build (ordered)

1. **Schema** (`flash/flash-schema.ts`): add `FlashBatchResultSchema = { candidates: [{ id, personas: FlashPersona[10] }] }` + `coerceFlashBatchResponse(raw, expectedIds)` — tolerate `{candidates}`/bare-array/fenced; **per-candidate salvage** (a short/malformed candidate drops itself, never nukes the batch); map by id, positional fallback. Keep `FlashResultSchema`/`coerceFlashResponse` (N=1 stays for script + react).
2. **Prompt** (`flash/flash-prompts.ts`): extract a shared archetype-block builder; add `buildFlashBatchSystemPrompt(panel?, repaint?)` (reuses the block, batched output schema) + `buildFlashBatchUserContent(candidates, framing, intent?)` (id-delimited list + the proven independence directive + framing question + restate batched schema). **Single-path prompt bytes stay identical** (guard test) → react modal unaffected.
3. **Batched call** (`flash/run-flash-text-mode.ts`): `runFlashTextModeBatch(candidates, framing, panel?, repaint?, intent?) → { results: Map<id, FlashResult>, warnings }`. Same envelope (temp0+seed+json_object+strip+coerce+zod). Timeout 90s (N≤5 ≈ ~35s measured-ish; headroom). Keep `runFlashTextMode` (N=1).
4. **hooks-runner:** generate **5** (drop the over-gen buffer framing); `gateHooks` → `rateHooks`: ONE `runFlashTextModeBatch`; per candidate aggregate→band→card; **rank** (keep existing sort) but **no Weak cut, no trim**; remove D-06 regen; keep flywheel rank-1 pin; attach personas to each card.
5. **ideas-runner:** same, count **4**.
6. **remix-runner:** SIM all **3** concepts (batched) not `concepts[0]`; rank; ship 3 cards.
7. **ENGINE_VERSION** `3.19.0 → 3.20.0` (`engine/version.ts`); update `version.test.ts` + `audience-regression-gate.test.ts` (the "no deliberate scoring change" guard is intentionally tripped — update w/ comment: S3′ is the deliberate change).
8. **steer-closure rebaseline** (`tools/runners/__tests__/steer-closure.test.ts`): re-baseline to the batched path; preserve the invariant (General/no-audience → deterministic, weighting-free bands; audience-vs-General divergence intact). Rebaseline, don't delete.
9. **Tests:** batched-coercion units (per-candidate salvage, id-mapping, short/malformed); runner tests (keep-all, no-cut, rank order, counts 5/4/3); determinism (same candidates twice → identical bands).

## 4. Hard constraints (unchanged from handoff)

D-17 cache discipline (candidate text in USER msg only) · determinism (temp0+seed) · honesty
spine (band+fraction only, no fabricated numbers) · keep N=1 `react` path working + on the shared
archetype block · ENGINE_VERSION bump + gate rebaseline (not delete).

## 5. Verify

`node ./node_modules/vitest/vitest.mjs run` (full suite; baseline ~3025/0/28) · `npx tsc --noEmit`
(baseline 64, add 0) · `npx eslint <touched>` · steer-closure + version + regression gates green
(version intentionally updated) · live E2E: one hooks (5 cards) + one ideas (4) + one remix (3) +
one react (modal N=1 unaffected).

## 6. Out of scope (PR-1)

DomainPack/pluggable scoring (GSI milestone) · the modal UI read (PR-2) · the rewrite loop (PR-3) ·
video fold (R1, separate) · script multi-variant (keep 1).
