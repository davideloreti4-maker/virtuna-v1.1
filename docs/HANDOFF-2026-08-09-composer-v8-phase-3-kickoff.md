# Handoff — Phase 3 (the report) kickoff · lane/platform-concept

> **Written 2026-08-09 at the end of the Phase-2 implementation session.** Phase 2 (the shelf)
> is BUILT, VERIFIED and PR'd (#458). This doc is the fresh-session kickoff for Phase 3 and
> records the seams Phase 2 left plus the traps that cost time this session.
>
> **Precedence chain is unchanged:** `docs/HANDOFF-2026-08-08-concept-v8-implementation.md`
> (SSOT — decisions, build order, cautions) → the spec (revision blocks override body) →
> the mock (layout/anatomy ONLY). This doc ADDS Phase-2 outcomes; it overrides nothing.

## 1. What Phase 2 shipped (and where Phase 3 plugs in)

All behind `CONCEPT_V8_ENABLED` (+ requires `NEXT_PUBLIC_AMBIENT_V2=true`). 12 commits
`f03ae3f4..a0ba21eb`, **PR #458 open against main** (flag-off inert; both new routes 404
without the flag). Plan with full task detail:
`docs/superpowers/plans/2026-08-08-composer-v8-phase-2-shelf.md`.

| Piece | Where | Phase-3 relevance |
|---|---|---|
| Drops producer | `src/lib/surfaces/drop-reactions.ts` (`buildLiveDrops`: rank.ts round-robin + daily window `drop-select.ts` → per-row `adapt.ts` → ONE batched Flash) | Drop cards carry REAL `personas` — the report's Audience tab for a DROP reads them, no new sim needed. |
| Cache | `surface_reactions` kind `'drop'` (CHECK **migration APPLIED** to the shared project; `SurfaceKind` extended) | — |
| The shelf | `src/components/app/home/v8/drop-shelf.tsx`, mounted at BOTH v8 arrival points in `composer.tsx` (search `<DropShelf`) | **The meter is display-only — Phase 3 wires meter tap → the report.** `DropCard` needs an `onMeter` door. |
| Remix seed | `drop-seed.ts` + `POST /api/surfaces/drops/remix` → real persisted thread (user turn + 3 `remix-card` blocks, `provenance:"projected"`, UNSCORED) | Seeded cards render the existing `SimDoor` ("Simulate with your audience →") — Phase 3's fire-on-demand hooks into the same door. |
| Schema change | `RemixCardBlockSchema.sourceDecode` now `.optional()`; renderer guards absence (`remix-card-block.tsx`) | Runner cards still ALWAYS carry it. |
| Warm plumbing | `composer.tsx`: `warmAudienceKey` (advances only AFTER the last-audience PUT settles), `handleRemixDrop` (cookie → id → `switchThread()`), `dropsEnabled` gate | Same handoff pattern works for opening a report from a card. |
| Room overlay placeholder | `v8/sub-bar.tsx` `RoomOverlay` (currently reuses `AmbientOverviewRail`; comment at the composer mount says "Phase 3 turns this into the three-tab report") | **This is Phase 3's main build site.** |

## 2. Phase 3 scope (SSOT §4.3 — do not re-litigate)

**The report**: three-tab sheet (mobile) / overlay panel (desktop, **pinnable**) built from the
rail's EXISTING views — **Audience** (verdict + ten faces, why-stopped/why-scrolled, one quote) ·
**Brain** (the existing WebGL cortex, relocated, heat in plain language) · **Engagement**
(watch-through curve + signals vs baseline). Every tab ends in a fix-phrased action that feeds
the thread as a steer. Opened from: any card's meter (drops: pre-run personas; thread cards:
their sim) + the sub-bar "Simulate ›" door. **Simulate actions on cards fire-on-demand**
(`fireSim` + sealed-verdict law carry over untouched). **`AmbientOverviewRail` retirement
completes here** (also resolves the ≥xl rail + RoomOverlay coexistence left from Phase 1).

Existing machinery (verified — reuse, don't rebuild): the rail's Brain/Engagement/Audience
views + WebGL brain · `fireSim` + sealed-verdict law · drop `personas` (already on every card) ·
mock §6 (report anatomy) + §10 (desktop pinning) — content fabricated, layout only.

## 3. Binding constraints that bite Phase 3 specifically

- **Fire-on-demand is the law.** Generation NEVER auto-simulates; only drops arrive pre-scored.
  Opening a report on a drop READS its cached personas — never re-sims. Never fire per
  keystroke; debounce; every room reaction costs credits.
- **The Flash SIM is platform-blind** — never imply the verdict moved with the platform lens.
- **No corpus multiplier numbers; donor niche never shown; accent dosage locked** (live dot only).
- Flag-off byte-identical; gates before any push (`tsc` binary · `npm run build` · vitest with
  pipefail); never commit the two `/start` files; explicit `git add` paths only.
- Drop economics (#3) still an open owner call — nothing billed, routes 404 in prod. Keep it so.

## 4. Traps hit in the Phase-2 session (avoid re-paying)

1. **The e2e account's open thread HAS CONTENT** → `hasConversationContent` is true → the
   empty-home arrival (where the shelf lives) NEVER mounts. Browser probes must set the
   blank-thread sentinel cookie: `maven_active_thread=__new__` (render-only, exactly what the
   sidebar's New Thread does). Without it the first probe burned 5 min on a race: arrival is
   visible only during the pre-rehydration window, then the thread branch swaps in.
2. **Projected cards withhold the fraction ON PURPOSE** — `SimDoor` "states the aim only" for
   `provenance:"projected"`. Don't assert "N/10 stop" on a seeded/unscored stack; assert
   "Simulate with your audience" + absence of the fraction.
3. **The shared adapt Zod caps reject real output** (`angle` ≤300 chars; `production.setup`
   required when production present) → that row drops → an honest 5/6 shelf. Known cheap
   follow-up: clip the bridge's exemplar lengths in `drop-adapt-input.ts`.
4. **Write/Edit tools are path-guarded to the worktree** — scratchpad files and the memory
   directory must be written via Bash (heredoc/python).
5. **Port 3005 was held by another process** (left alive — likely a co-session). 3006 free.
6. **`getByText("Remix")` is ambiguous in composer tests now** — the shelf adds Remix buttons;
   scope panel queries with `within(panel)`.
7. **Commits appear on origin without an explicit push** ("Everything up-to-date" on first
   push; remote already at HEAD) — a repo hook evidently pushes on commit. Verify with
   `git rev-parse HEAD origin/lane/platform-concept`, don't assume.
8. Full-suite baseline: exactly ONE failure, `routing-cut.test.ts` (the uncommitted `/start`
   restore, owner call §7.2 — pre-existing, this worktree only). Same count before/after = green.
9. Verified-working probe scripts live in this session's scratchpad
   (`/private/tmp/claude-501/-Users-davideloreti-virtuna-platform-concept/e3657174-*/scratchpad/`):
   `mint-auth.mjs` (Supabase REST → storage-state.json), `shoot-shelf.mjs` (two contexts AT
   size, sentinel cookie, accent sweep, pixel-level cover checks), `flagoff.mjs`. Rewrite ≈5 min
   if the tmp dir is gone. E2e user is a REAL PROD account: render/open only, never fire runs.

## 5. State at handoff (2026-08-09)

- Branch `lane/platform-concept` @ `a0ba21eb`, pushed; **PR #458 open** (main unmoved at push
  time — re-measure before any new push). Vercel git DISCONNECTED — merging does not deploy.
- **DB side effects (shared dev/prod project):** the `kind` CHECK migration is APPLIED
  (`supabase/migrations/20260808193000_surface_reactions_drop_kind.sql`, additive). One real
  `'drop'` cache row exists for the e2e user's calibrated audience (5 cards, 2026-08-08 22:35Z —
  TTLs out after 18h). Two seeded test threads sit in the e2e account's sidebar (cheap rows,
  archive if annoying). One paid warm was fired (≈6 adapt + 1 Flash), sanctioned once.
- Memory updated: `platform-concept-lane.md` (Phase 2 state + findings).
- The two uncommitted `/start` files remain uncommitted (owner call #7 — leave them).
- Owner calls riding with PR #458: economics #3 · multiplier basis #1 · copy (direction-grade,
  marked) · skills-panel taxonomy (§7.6) · optional cover backfill (43 rows,
  `scripts/backfill-corpus-covers.ts`). Still open from the concept doc: #4 decode cross-domain
  test, #5 corpus cadence/saturation, #8 day-0 lane synthesis producer.

## 6. Kickoff prompt for the fresh Phase-3 session

```
Phase-3 implementation session for platform concept v8, worktree
~/virtuna-platform-concept (branch lane/platform-concept — git fetch + pull first; Phase 2
is in PR #458, possibly merged).

Read, in order:
1. docs/HANDOFF-2026-08-09-composer-v8-phase-3-kickoff.md  (Phase-2 seams, traps, scope)
2. docs/HANDOFF-2026-08-08-concept-v8-implementation.md    (SSOT — decisions, cautions §5–7)
3. docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md  (spec — revision blocks
   at the top override the body; §2 has the report)
4. docs/mockups/concept-v2-2026-08-08.html §6 + §10  (report anatomy + desktop pinning ONLY —
   content is fabricated)

The concept is SETTLED — do not re-litigate. Build Phase 3 (the report) behind the existing
CONCEPT_V8_ENABLED flag: the three-tab verdict report (Audience / Brain / Engagement) from the
rail's EXISTING views — bottom sheet on mobile, overlay + pinnable panel on desktop; opened
from any card's meter (drop cards read their CACHED personas — never re-sim) and from the
sub-bar "Simulate ›" door; Simulate actions on cards fire-on-demand via the existing fireSim +
sealed-verdict law; AmbientOverviewRail retires (its ≥xl mount + the v8 RoomOverlay
placeholder in v8/sub-bar.tsx are the build sites). Plan it first (superpowers:writing-plans),
then build TDD, then verify signed-in in a real browser at 393×852 and 1440×900 (render-only —
the e2e user is a real prod account; set the maven_active_thread=__new__ sentinel cookie or
the empty-home arrival never mounts).

Hard rules: fire-on-demand (generation never auto-simulates; drops read cached personas);
never imply the verdict moved with the platform lens (Flash is platform-blind); no corpus
multiplier numbers; donor niche never shown; zero accent beyond the live dot; flag-off stays
byte-identical; debounce anything that fires sims. Drop economics (#3) stays an open owner
call — no billing wiring. Gates before any push: node node_modules/typescript/bin/tsc
--noEmit, npm run build, npx vitest run (pipefail; baseline = exactly one pre-existing
routing-cut failure). Never commit the two uncommitted /start files; explicit git add paths
only.
```
