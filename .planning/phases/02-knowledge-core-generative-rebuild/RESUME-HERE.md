# RESUME HERE — Phase 02 COMPLETE ✓ (next: Phase 03 Ideas Tool)

**Written:** 2026-06-17 (session 3) · **Status:** Phase 02 verified PASSED (3/3 must-haves, GROUND-01 + GROUND-02).
**Next cmd:** `/gsd-discuss-phase 3` then `/gsd-plan-phase 3` (Ideas Tool — the moat chain begins).

## What landed (Phase 02 — Knowledge-Core generative rebuild)
- **Waves 1–4 ✅** 02-01 (KC code spine) · 02-02 (live-tier assembler, GROUND-02) · 02-03 (BASE + Ideas pilot) · 02-04 (D-12 blind gate PASSED) · 02-05 (Hooks + chat slices).
- **02-05 finished this session:** owner-curated `hooks.md` + `chat.md` to D-10 —
  - **Scaffolding-leak fix:** archetype slugs (`[BOLD]`/`[GAP]`) are now PRIVATE diversity bookkeeping, NEVER emitted (aligns with curated `ideas.md` + BASE Output Discipline). Added "Hook Reasoning Scaffold → Clean Deliverable" + deliverable-boundary line.
  - **Multi-modal hooks correction (owner):** a hook is not only the spoken line — also opening visual/shot, on-screen caption, the edit/cut, and audio cues (often stacked). Mechanisms are channel-agnostic; Component 3 + a new **Channel** field cover all channels.
  - `chat.md` kept thin (D-14); full polish still deferred to P5.
- **Recompiled** byte-stable → `compiled.ts` (0 skeleton placeholders).
- **Code review (02-REVIEW.md):** found 2 Criticals in `assembler.ts` — injection-fence overflow (CR-01: blind tail substring chopped the closing sentinel; CR-02: dead role-drop budget gate). **FIXED** (commit `1b35b361`) with `fenceSectionsWithinBudget` + 3 fence-integrity regression tests. 64/64 KC+flash green; full suite 2306 pass.
- **Verified PASSED** (`02-VERIFICATION.md`).

## ⭐ Carry into Phase 3 (don't lose)
1. **SIM is niche-blind** — per-idea SIM gives a flat 6/6/6/6/5 because the text Flash path uses generic, niche-blind, equal-weighted personas while the rich `selectPersonaSlots` + `NICHE_INSTANTIATION` + FYP-weighting engine (in `persona-registry.ts`) sits **unused** on the text path. This is **lever #10** in `.planning/research/kc-improvement-levers.md` (the top Phase-3 engine task). It's a wiring + threshold-calibration job — **NOT** a corpus fix.
2. **REVIEW.md WR/INFO notes** (non-blocking, Phase-3 polish): confined to the throwaway `scripts/kc-gate.ts` dev gate (`as never` cast, unseeded `Math.random()` shuffle, empty-Qwen-arm handling, dead `formatPlatform`) + test-quality (honesty-spine assertion strength, missing regen-kc byte-stability guard test).
3. **Compiler embeds HTML comments** — `regen-kc.ts` (D-03) compiles the full `.md` including `<!-- … -->` provenance comments into each system prompt. Pre-existing + gate-passed; optional cleanup is to strip author-only comments at compile time.

## Key references
- Corpus (the deliverable): `.planning/corpus/{base,ideas,hooks,chat}.md`. Compiler: `scripts/regen-kc.ts` (byte-stable; run after edits).
- Phase-3 backlog: `.planning/research/kc-improvement-levers.md` — 10 levers, SIM audit, the moat loop.
- Craft research (feeds future curation): `.planning/research/kallaway-craft-extraction.md`, `sandcastles-structural-insights.md`.
- Memory: `[[kc-corpus-authoring]]`, `[[numen-tools-vision]]`, `[[engine-model-assignment]]`.
- Config: USE_WORKTREES=false (sequential on main tree), executor=sonnet, verifier=opus, branch `milestone/numen-tools`, no branching.
- Transient (gitignored, regenerate): `kc-gate-BLIND.txt` / `kc-gate-KEY.txt` / `ideas-sim-rank.txt`.
