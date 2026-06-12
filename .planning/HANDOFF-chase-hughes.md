# HANDOFF — Chase Hughes Behavioral Layer

> Resume context for the Chase Hughes initiative. Written 2026-06-12.
> **Branch:** `feat/chat-ethics-gate` (committed + pushed, **PARKED, unmerged**).
> **To resume:** `git switch feat/chat-ethics-gate` then read this file.

---

## TL;DR — where this stands

We mined Chase Hughes' video transcripts into a **behavioral knowledge layer** for Numen, wired it into the engine (scoring) + chat, built an ethics gate, then **parked all of it on this branch undecided**. Nothing is in production: `main` is untouched at engine 3.19.0.

**The open question:** do we actually want §2.6 (the behavioral layer) in the scoring engine? Davide is unsure — the one A/B run was inconclusive and surfaced a real token-cost problem. **Decision deferred.**

---

## Why it's parked (do NOT merge yet)

1. **Engine freeze.** The active **Numen Surface** milestone (other session, `~/virtuna-numen-surface`) locked engine 3.19.0 as *presentation-only*. This branch bumps it to **3.20.0** + wipes the prediction cache — merging mid-milestone disrupts their SMOKE-GATE (validates vs frozen 3.19.0). **Merge only after Numen Surface ships.**
2. **§2.6 is unvalidated + expensive** (see A/B below).
3. Davide is **undecided on engine inclusion**.

---

## What's on this branch

### Research (`.planning/corpus/`)
- `KNOWLEDGE-CORE.md` — §2.6 behavioral layer now FILLED (33 detect-triples, 7 sub-groups §2.6.1–§2.6.7).
- `KNOWLEDGE-CORE-2.6-behavioral-DRAFT.md` — the staged Track A draft (source).
- `BEHAVIORAL-CORE.md` — Track B reasoning substrate (33 frames).
- `ETHICS-GATE-SPEC.md` — the ethics gate spec (corrected for streaming reality, §1.5).
- `_mining/chase-hughes/` — 17 transcript extracts + `_CRITIC-REPORT.md` (142-row ethics register) + `_SYNTH-track-*` + `AB-RESULT-skit-260612.txt` (the A/B output).

### Track A — engine scoring (WIRED, the contentious part)
- `src/lib/engine/apollo-core.ts` — §2.6 ported into the live `KNOWLEDGE_CORE` constant + `PRESENT_SECTIONS` extended (§2.6, §2.6.1–.7).
- `src/lib/engine/version.ts` — `ENGINE_VERSION` 3.19.0 → **3.20.0**.
- `src/lib/engine/__tests__/{version,aggregator}.test.ts` — version pins updated.

### Track B — chat (WIRED)
- `src/lib/chat/behavioral-core.ts` — `BEHAVIORAL_CORE` constant (Track B doc).
- `src/lib/chat/seed-context.ts` — injects `BEHAVIORAL_CORE` every chat turn; **also** the citation fix (real §-taxonomy replacing the fake §1–§10 legend).
- `src/components/command-bar/ExpertChatThread.tsx` — tooltip map → real taxonomy; regex catches dotted sub-sections (§2.6.3, §2.0a).

### Ethics gate — BUILT but DORMANT (off everywhere, not removed)
- `src/lib/chat/ethics-gate.ts` — tripwire + `buildEthicsPromptBlock()` + `gateAsyncDeltas()`. Header banner says DEACTIVATED. **Zero live references** (unwired from route + prompt by decision).
- `src/lib/chat/__tests__/ethics-gate.test.ts` — 58 tests (incl. dormancy assertion).
- `scripts/ethics-gate-eval.ts` — red-team harness (passed 0/12 leaks, 0/3 over-refusals when it was wired).
- Reactivate: inject `buildEthicsPromptBlock()` into seed-context + wrap stream with `gateAsyncDeltas()`. Required before chat goes user-facing IF Track B (manipulation corpus) ships — Qwen's safety blocks *illegal* not *manipulative* content.

### A/B harness
- `scripts/apollo-core-ab.ts` — §2.6 A/B: control (core minus §2.6) vs treatment (full), same Omni signals, deterministic. Run: `pnpm tsx scripts/apollo-core-ab.ts "<video.mp4>"`.

---

## The A/B result (1 video — inconclusive)

Ran on `~/Downloads/TikTok Video Downloader.mp4` (a comedy skit). Full output: `.planning/corpus/_mining/chase-hughes/AB-RESULT-skit-260612.txt`.

- **Composite 81 → 78** (treatment lower). Traceable to **Share-pull Strong→Mid** — §2.6.5 "identity installation" raised the bar. A *defensible refinement*, not noise.
- **§2.6 fires** (cites 0→2) but **thinly** — both cites were "couldn't observe" caveats (§2.6.1 composure / §2.6.4 pattern-interrupt are multimodal; the transcript-heavy Omni sensor can't feed them).
- **COST FLAG:** §2.6 **~doubled the core** — 7.3k → 15.9k tokens (~8.5k added, larger than all other sections combined). Rides every Apollo call (score + decode + adapt). Against the <90s E2E goal, that's real latency/$.
- **Caveat:** a comedy skit is the *worst case* for behavioral levers — under-tests the layer.

**Verdict:** works (fires, refines sanely, no regressions) but under-tested + expensive. Not enough to ship.

---

## Open decisions / next steps (when resumed)

1. **More A/B archetypes** — run `apollo-core-ab.ts` on an authority/talking-head creator, an emotional/persuasion piece, a sales/CTA video (where behavioral levers actually apply). One skit ≠ validation.
2. **Distill or gate §2.6** — at ~8.5k tokens it's bloated; likely trimmable 2–3× without losing the firing levers (identity-installation, limbic, pre-perception). Or gate it by content_type so skits don't pay for it.
3. **Engine inclusion decision** — does §2.6 go in the scoring engine at all? (Davide's call, pending 1+2.)
4. **Ethics gate fate** — currently dormant; reactivate before chat (Track B) goes user-facing, or decide to rely on Qwen.
5. **Merge timing** — only after Numen Surface ships; then rebase on new main, re-run build/tests, merge + deploy (or delete the branch if rejected).

## How to throw it all away (if rejected)
`git branch -D feat/chat-ethics-gate` + delete the remote branch. `main` is already clean — nothing to revert.
