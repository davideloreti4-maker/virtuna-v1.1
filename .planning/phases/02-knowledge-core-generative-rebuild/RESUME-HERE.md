# RESUME HERE — Phase 02, mid-02-05 (owner curation parked)

**Written:** 2026-06-17 (session 2) · **Resume cmd:** `/gsd-execute-phase 2` (discovers incomplete 02-05 and resumes)

## Where we are
- **Waves 1–3 ✅** 02-01 (KC code spine) · 02-02 (live-tier assembler, 25 tests) · 02-03 (BASE + Ideas pilot) · **02-04 blind gate PASSED** — all have SUMMARY.md.
- **Wave 4 ◆ 02-05 IN PROGRESS** — replicate the gate-proven shape to hooks + chat.
  - **Task 1 ✅** committed `4c583438` — `hooks.md` (full-depth, 5 archetypes) + `chat.md` (thin stance-slice riding BASE) **drafted**.
  - **Task 2 ⏸ PARKED — owner red-line.** `hooks.md` + `chat.md` await owner curation to taste bar. They still carry `<!-- DRAFT — pending owner curation -->` markers.
  - **Task 3 ○** recompile all 4 prompts byte-stable + write 02-05 SUMMARY. Blocked on Task 2.

## NEXT STEP (do this on resume) — finish 02-05
1. **Owner curates** `.planning/corpus/hooks.md` + `chat.md` to the taste bar; remove the `<!-- DRAFT -->` markers.
   - Apply the SAME improvements I made to `ideas.md` this session (see below) where they fit: clean output discipline (no scaffolding leak), ship the deliverable not a schema, register/tonal variety. The BASE router + "Scaffolding Is Private" already apply to all modes automatically — but the hooks/chat slices may need their own deliverable-boundary line like Ideas got.
2. **Recompile:** `npx tsx scripts/regen-kc.ts` (byte-stable; run after any `.md` edit).
3. **Verify:** `npx vitest run src/lib/engine/flash src/lib/kc` (was 61/0 green).
4. **Write `02-05-SUMMARY.md`**, mark plan done, then phase verification/completion (`/gsd-execute-phase 2` will route to the verifier once no incomplete plans remain).

## What changed THIS session (beyond the 02-05 plan — KC iteration, all committed)
Committed on `milestone/numen-tools`; latest clean commit `cae58ab5`.
- **Qwen fallback fix** (`ce690676`): `src/lib/ai/{deepseek,gemini}.ts` now import `QWEN_REASONING_MODEL` (was a divergent `qwen3.6-plus` literal). Video model = `qwen3.5-omni-flash`, reasoning/text = `qwen3.7-plus` — confirmed correct.
- **kc-gate fixes** (`scripts/kc-gate.ts`): SIM verdict mapping `green`→`stop` (was dead), sequential→parallel arms (was timing out).
- **Ideas slice craft fixes** + **BASE mode-router** + **idea-question reframe** (`cae58ab5`):
  - BASE `## Modes & Your Current Job` (TEST/IDEAS/HOOKS/CHAT — stay in lane). Fixes the Apollo-scores-instead-of-generates drift.
  - Ideas: deliverable is the CONCEPT + substance ("ship the film, not the trailer"); no `[ARCHETYPE]` leak; FORMAT/SHOOT line per idea; de-templated "why it works."
  - `flash-prompts.ts` idea-framing: judge the idea AS THE FINISHED VIDEO it describes (coherent concept-level gate).
- **New prototype** `scripts/ideas-sim-rank.ts` — the moat loop (generate → per-idea SIM → rank). Works; output in `ideas-sim-rank.txt`.

## ⭐ The key open finding (don't lose) — SIM is niche-blind
The per-idea SIM gives a **flat 6/6/6/6/5** because the **text Flash path uses generic, niche-blind, equal-weighted personas** while the rich `selectPersonaSlots` + `NICHE_INSTANTIATION` + FYP-weighting engine (in `persona-registry.ts`) sits **unused** on the text path. This is **lever #10** in `.planning/research/kc-improvement-levers.md` — the top Phase-3 engine task. Full audit + the SIM-as-GATE-not-ranker reframe are in that file. **Do NOT try to fix discrimination in the corpus — it's a wiring + threshold-calibration job (Phase 3).**

## Key references
- Corpus: `.planning/corpus/{base,ideas,hooks,chat}.md`. Compiler: `scripts/regen-kc.ts` (byte-stable; run after edits).
- Backlog (READ THIS for Phase 3): `.planning/research/kc-improvement-levers.md` — 10 levers, SIM audit, the moat loop.
- Research (feeds hooks/chat curation): `.planning/research/kallaway-craft-extraction.md`, `sandcastles-structural-insights.md`.
- Memory: `[[kc-corpus-authoring]]`, `[[numen-tools-vision]]`, `[[engine-model-assignment]]`.
- Config: USE_WORKTREES=false (sequential on main tree), executor=sonnet, verifier=opus, branch `milestone/numen-tools`, no branching.
- Transient (gitignored, regenerate — don't trust stale): `kc-gate-BLIND.txt` / `kc-gate-KEY.txt` / `ideas-sim-rank.txt`.
