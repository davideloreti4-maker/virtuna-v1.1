# Spike — Grounded Generation thesis validation (2026-07-09)

**Verdict: GO.** The core bet — grounding hook generation in live-scraped outlier teardowns, with a
receipt, beats cold generation and materializes the doctrine (*real work + real proof + made for me*) —
is validated end-to-end on real APIs. Two small, concrete integration findings surfaced (both fixable,
neither a blocker).

Throwaway harnesses (kept for rerun, NOT productized):
- `scripts/spike-grounding.ts` — v1, mechanism proof.
- `scripts/spike-grounding-v2.ts` — v2, real voice + receipt + watch.
- Rerun: `npx tsx scripts/spike-grounding-v2.ts "high protein breakfast" "high protein breakfast" 3 --watch`

## Pipeline exercised (all real, wired paths)
scrape 30 (clockworks `searchQueries`) → `rankOutliers` (outlier-compute.ts) → fetch native subs +
extract teardowns (`qwen3.7-plus`) → `assembleBundle` (grounding injected via the real `overrides`
injection fence — **zero prod edits**) → generate hooks (`qwen3.7-plus`, json_object, thinking-off) → compare.

## v1 — mechanism (null profile)
- scrape 30 in **8.9s** (free-plan clockworks). Top outlier `@srenestrawberry · 178.3× · 14.7M` (real, clickable).
- extraction → reusable **structural** teardowns (archetype + `[slot]` template + why). **0/3 native subs**
  → Option B (caption inference) carried all three.
- grounded hooks inherited the proven structures 1:1. Total **24.7s**, 3 LLM + 1 scrape.
- **Honest limits:** on pure hook-craft, cold ≈ grounded with a null profile; grounding sometimes
  **parroted** the source caption ("crispy cottage cheese egg cups"); the 178× *visual* outlier's teardown
  was shallow without a video-watch.

## v2 — value (real voice + receipt + watch)
Synthetic creator: blunt "busy-dads high-protein" trainer, anti-guru voice (deliberately distinct so
adapt-vs-copy is legible). 3 arms — **A** cold+null · **B** cold+voice · **C** grounded+voice.
- **B (voice alone)** is a big lift over A — hooks clearly target the persona ("12 minutes before my shift…").
- **C (the product):** 3/5 hooks adapt a proven structure **and carry a receipt** (`@handle · mult · views · url`);
  2/5 are honestly flagged **"(no source — pure craft)."**
- **Over-copy FIXED** — v1's parrot is gone: C#2 uses the source's *structure* but the creator's *own*
  narrative (picky kids + dad macros). Fix = "translate the mechanism, don't reuse the words" + a real
  voice to translate *into*.
- **Receipts attach** — sourceIndex→receipt wiring works; honesty-spine labeling of ungrounded hooks works.
- **Positioning nuance:** voice already closes most of the *craft* gap; grounding's unique value is
  **proof + structure-transfer + honest-labeling**, NOT craftier prose. **Sell the receipt.**

## Two findings (small, real, fold into the build)
1. **Tier-2a watch** → `400 InvalidParameter: Failed to download multimodal content`. `qwen3.7-plus`
   **accepted** the `video_url` field but couldn't *fetch* the raw Apify KV mp4 → it needs the **Apify
   token appended** (the omni path already does this; the spike passed it raw). **Tier-2a = mp4-delivery
   PLUMBING, not a capability wall** (matches §9's "background/anchored, not free-inline").
2. **Outlier metric is sample-jittery** — the SAME `@srenestrawberry` video read **178.3× (v1) vs
   208.5× (v2)** because `views÷median-of-result-set` depends on which 30 the scrape happened to return.
   A "proof" number that wobbles 178→208 between pulls is a credibility risk → a durable receipt wants
   the **per-account** basis (`views÷followers` / `views÷account-median`). **Live evidence for
   open-thread #2 + the §13 `follower_count` landmine.**

## Build implications
§11f build order holds. Two refinements the spikes earned:
- **Stabilize the outlier metric to a per-account basis** before the multiplier becomes a shown "proof".
- **Treat Tier-2a as a token-appended-mp4 plumbing task** (background/anchored, per §9).
