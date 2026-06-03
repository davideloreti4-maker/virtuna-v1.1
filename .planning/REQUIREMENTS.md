# REQUIREMENTS — Apollo

Milestone-scoped requirements. Derived from `ENGINE-MAP.md`. Each is testable; phase mapping in `ROADMAP.md`.

## Functional

- **R1 — Senses emit words.** Omni returns `hook_verbatim` (spoken_words + on_screen_text for the first ~3s) and per-segment `spoken_text` + `on_screen_text` (verbatim, not paraphrase). _Verify: a video run persists non-empty verbatim fields._ → P2

- **R2 — Apollo Reasoner (Brain 1).** A single Qwen reasoning call grounded in a distilled Chase Hughes knowledge core (stable, cached system prompt) produces: a directional read, a critique, and **rewrites that quote the creator's actual line and offer 2–3 drop-in variants.** Absorbs platform-fit reasoning (incl. watermark cross-post warning). _Verify: output contains a rewrite whose `original` matches the verbatim hook._ → P3

- **R3 — Audience-Sim (Brain 2).** A single grounded call folds the 20 persona calls. Knowledge = `persona-registry.ts` archetypes. Fed verbatim + segments + keyframes + emotion arc. Emits a per-archetype × per-segment reaction matrix → retention heatmap + behavioral aggregate. _Verify: heatmap renders from one call's output._ → P4

- **R4 — Audience-aware insight.** Sequencing is `Omni → Audience-Sim → Apollo`; Apollo's rewrites reference where archetypes drop (e.g. "loses tough_crowd at 0:02"). _Verify: a rewrite cites an archetype bounce point._ → P5

- **R5 — Directional score.** The 0–100 fake-precise score is replaced by an honest directional band (strong/mid/weak) derived from the two brains. No Platt/calibration scaffolding, no 7-source blend. _Verify: UI shows a band, not a fabricated precise number._ → P1, P5

## Non-functional

- **R6 — Under the cap.** Video-mode E2E completes under the 300s Vercel cap with headroom (target ≤90s). _Verify: `scripts/measure-pipeline.ts` E2E run._ → P1, P4

- **R7 — ~3 LLM calls.** Video-mode hot path = Omni + Audience-Sim + Apollo (≈3), down from ~24–25. _Verify: stage-event call count._ → all

- **R8 — Determinism preserved.** temp 0 + seed on every surviving call; same video → same output. → all

- **R9 — Honest by deletion.** `predicted-engagement` (fabricated counts), `ml.ts` (disabled), `audio-fingerprint` (dead), `trends` (empty), the score-blend, and the vestigial stage10/stage11/platform_fit/rule-semantic calls are removed or dormant — no dead/fabricated signal reaches the user. _Verify: grep + UI audit._ → P1

## Validation gate (the bet)

- **R10 — Fold proven, not assumed.** Before the folded Audience-Sim replaces the 20 personas in production, A/B it against the current 20 on a handful of real videos; the grounded single call must reproduce or beat the retention-curve quality. _Verify: A/B report._ → P4

## Open dependency (blocks P3)

- **The Chase Hughes corpus.** What data, what form, and how it's distilled into the cached Apollo system prompt is the milestone's biggest unknown and the moat. Must be pinned down before/within P3.
