# Ambient Audience v2 — Phase D SHIPPED (2026-07-23) · fresh-context kickoff

Branch `design/ambient-audience-v2` · worktree `~/virtuna-ambient-audience-v2` · dev **:3007** (NOT
:3011 = stale skill-cards-prod). **Merged to main: PR #373, merge `3ae89bfe`** (code commit
`d303ba5d`). Full provenance audit + prior sessions:
`docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md`.

## Where the v2 audience surfaces stand

Behind the flag `NEXT_PUBLIC_AMBIENT_V2=true` (env-gated; OFF ⇒ legacy `AudiencePresence` byte-
identical). Mounted in the composer's ≥xl thread-rail portal + the empty-home Start grid.

| Surface | State |
|---|---|
| ④ Start | ✅ mounted on real data (name + audience + real SKILL_RUN_META grid); post-pick → normal fresh-chat with skill armed |
| ① Overview | ✅ mounted; ranked projection rows + **REAL sealed sims** (measured %) that **survive reload** |
| ⑤ Simulate (develop) | ✅ arm card; its Run fires the real sim |
| ② Brain depth · ③ Population depth | 🔴 NOT mounted; producers still fixture/fabricated (Phase C) |

## What shipped THIS session (Phase D)

1. **Start polish** — post-pick drops into the normal fresh-chat home with the skill armed
   (`composer.tsx`); `startEngaged` resets on thread switch → new/empty thread shows the Start grid.
   Conditions strip kept between greeting + grid (owner call).
2. **Real sealed sims** — the Overview "Simulate →" fires `POST /api/tools/react` → parses the honest
   `"N/10 stop"` fraction → seals the row with a measured would-stop %, above every queued row.
   Sealed watcher shown in-flight; a failed/unparseable run does NOT seal.
3. **Flywheel pin relocated** — opt-in `pin` flag on `/api/tools/react` (default OFF) fires
   `pinPredictedSignature` on the deliberate sim (non-fatal; `audienceId` null for virtual audiences).
4. **Seal persistence (Option A)** — migration `20260723090753_thread_sim_seals.sql` adds
   `threads.sim_seals jsonb` (**APPLIED to the DB** via Supabase MCP, project `virtuna-v1.1` /
   `qyxvxleheckijapurisj`; column verified `jsonb NOT NULL default '{}'`). Store `{ trimmed concept
   text → { pct, band, at } }`. `src/lib/threads/sim-seals.ts` (read validate-or-drop / write merge,
   non-fatal); opt-in `persist` flag on react writes it; `/api/threads/open` returns `simSeals`;
   composer rehydrates → `AmbientOverviewRail` merges persisted (by concept text) + in-session (by id)
   into `measured`. **Score now survives reload.**

## 🔑 The architecture facts that shaped it (do not re-learn the hard way)

- **`/api/tools/simulate` + `runSimulate` are Directional-ONLY.** `SOCIALS_CALIBRATION.baselineRef`
  is set → the default `GENERAL_AUDIENCE` (mode `socials`) and every calibrated audience resolve
  **Validated** → that verb REJECTS them (400). It is for `mode:"general"`/person DM-reaction SIMs.
  **The content-vs-audience sim primitive is `POST /api/tools/react`** (server-resolves the active
  audience off the thread; runs `runFlashTextMode` + `aggregateFlash`; returns
  `{ fraction, scrollQuote, personas, population }`).
- **`AmbientCardDescriptor.id` is POSITIONAL (`hook-0`)** — not stable across reload, not unique. Any
  persistence MUST be content-addressed (by trimmed concept text), NOT by id.
- **Persistence must NOT reuse thread-message persistence** — that injects a `reaction-distribution`
  CARD into the chat (pollution). The jsonb column on `threads` is the store.
- **Honesty spine holds:** projected rows are `queued` (personaStops /10); the measured % is withheld
  until a real sim seals; a sealed row outranks every queued one; no fabricated %.

## ▶ NEXT (priority order)

1. **Phase C — Brain/Population depth producers.** Blocked on a rich **SimSnapshot** store (Option B:
   a `sim_snapshots` table holding personas/population/per-lens/brain, versioned) — the current jsonb
   seal is verdict-only. The ② Brain / ③ Population surfaces are still fixture-driven + unmounted.
   Producers to build (derive-from-craft, owner-approved): video attention/craft signals · behavioral-
   lens runs (buy/share/follow) · modeled neuro decomposition · `audienceFit` baseline. See the
   provenance audit's Phase C section + the field-by-field table.
2. **Cutover** — rip `AudiencePresence`, wire the full Start → Simulate → Overview → Brain flow as the
   whole rail, retire `NEXT_PUBLIC_AMBIENT_V2`.

## ENV / gotchas / verification

- Dev :3007. Launch (setsid-detach dies after ~1 req in this env — restart as needed):
  `NODE_OPTIONS='--max-old-space-size=2048' NEXT_PUBLIC_AMBIENT_V2=true node ./node_modules/next/dist/bin/next dev -p 3007`
  (Python `os.fork()`+`setsid` to survive foreground commands; `rm -rf .next` after branch switch.)
- **Screenshots HANG** on this app → DOM-verify / trust unit tests.
- Tests: `node ./node_modules/vitest/vitest.mjs run <file>` (NOT `npm test`).
- Gates: tsc 0 · eslint 0 · matte `src/components/reading/__tests__/reskin-matte.test.ts` 38/38 ·
  `/ambient-v2` 200 · `/home` 307 (auth redirect, compiles).
- Preview: `NEXT_PUBLIC_AMBIENT_V2=true` → `/home`, ≥xl window for the rail; tap a ranked row / the
  quick-sim door to fire a real sealed sim.
- Supabase MCP project id for `virtuna-v1.1` = `qyxvxleheckijapurisj` (migrations recorded there).

## Files this session (all merged in PR #373)
`composer.tsx` · `AmbientOverviewRail.tsx` (+test) · `api/tools/react/route.ts` (+test) ·
`api/threads/open/route.ts` · `lib/threads/sim-seals.ts` (+test) · `types/database.types.ts` ·
`supabase/migrations/20260723090753_thread_sim_seals.sql` · `lib/threads/__tests__/open-thread.test.ts`
(fixture) · the wiring provenance-audit handoff.
