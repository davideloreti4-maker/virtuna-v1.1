# GAP-REMIX-01 — Remix skill `decode` returns null (decode_failed)

**Found:** 2026-06-20, Phase 11 Explore live UAT (Test 5).
**Area:** viral-remix skill (Phase 6) + engine — NOT Phase 11 Explore.

## Symptom
"Remix → Read" from an Explore tile fires the chain correctly (handoff → `POST /api/tools/remix/run`, in-place on /home, clockworks resolves the video). The omni analysis **COMPLETES** (`omni analysis complete {emotion_arc_points:6, verbatim_present:true}`), but the remix skill's downstream **decode step returns null** → `decode_failed` (graceful Pitfall-6). Reproducible across 2 different videos. Result: no remix-card / no persona reaction surfaces.

## Impact
Blocks the visual end of the discover→remix→Read chain (Explore Test 5 "lands on a Read + real reaction"). Explore's own contract is satisfied.

## Where to look
`/api/tools/remix/run` route + the remix skill's decode/structured-output step (the analysis→remix transform that returns null). Check the reason model output/parse for the decode phase. dev log marker: `WARN remix run returned error {error:"decode_failed", warnings:["Decode returned null — decode_failed graceful (Pitfall 6)."]}`.

## Note
Independent of the Phase-11 clockworks scrape swap (Remix rehost was already clockworks).
