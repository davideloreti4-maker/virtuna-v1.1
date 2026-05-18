# Audio Smoke-Test Fixtures (Phase 6 Wave 0)

Per Phase 6 Plan 01 (Wave 0 smoke test gating SC#1), drop THREE short .mp4 files in this directory before running the smoke test:

1. `talking_head.mp4` — A short (~10s) clip of a creator speaking on-camera with clear voice. Examples: educational creator explainer, vlog intro. Required for voice_clarity / audio_hook scoring per D-A2.

2. `slideshow.mp4` — A short (~10s) clip with static images + background music, NO speech. Examples: product showcase, infographic-style edit. Required to verify D-A2 content-type gating (voice_clarity / audio_hook should be null or ignored).

3. `music_heavy.mp4` — A short (~10s) clip with prominent background music + minimal speech. Examples: dance video, fashion B-roll. Required to verify music_ratio dominates.

Each file should be ≤25 MB (Gemini Files API limit on standard tier). Trim with ffmpeg if needed:

```bash
ffmpeg -i input.mp4 -t 10 -c copy output.mp4
```

## Run the smoke test

```bash
pnpm tsx scripts/smoke-test-gemini-audio.ts
```

Requires `GEMINI_API_KEY` in `.env.local`. Optional: override `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).

## Output

Results are written to `smoke-test-results.json` in this directory (gitignored — see top-level `.gitignore`). Pass criterion: ≥9/9 field-validation gates pass across the 3 fixtures (3 fixtures × 4 gates each = 12 gates; ≥9/12 acceptable for v1).

Each result row contains:
- `audio_signals` — the raw Gemini response shape (voice_clarity_0_10, audio_hook_first_2s_0_10, silence_ratio, voiceover_ratio, music_ratio, audio_description)
- `validation` — per-field pass/fail booleans + computed ratios_sum
- `raw_text_preview` — first 200 chars of Gemini's raw JSON for debugging

## Failure path

If the smoke test fails (Gemini omits fields, ratios drift outside ±0.1, descriptions are missing or out of [10, 300] char range):

1. Pause Phase 6 — do NOT proceed to Plan 02
2. Return to `/gsd-discuss-phase 6` to revisit D-A1 (audio source mechanism)
3. Options: (a) prompt refinement, (b) move to dedicated Gemini audio-only call, (c) accept lower reliability and tune the audio signal weight downward

## Privacy note

Choose non-sensitive fixture videos (publicly available creator clips). Uploaded files are processed per Google's standard Gemini API data-use policy. Fixtures and results are gitignored — never committed.
