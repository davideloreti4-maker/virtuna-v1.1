# HANDOFF — the omni modality split (omni stops watching)

**Written** 2026-08-04 · **Branch** `lane/omni-modality-split` (off `main` @ `470ef6ae`) ·
**Worktree** `~/virtuna-slot-b`

> ⚠️ `main` moved five times in one recent session and a co-session merged a PR out from under
> live work. `git fetch` and re-measure every sha here before acting on it. Read refs with
> `git rev-parse`, never `git log --oneline` — it elides merges in this repo.

---

## 1. What this is

The Wave 0 read used to be ONE `qwen3.5-omni-flash` call that both watched the video and heard it.
omni is the only audio-capable model in the stack, so it was being paid to watch — 17,228 of its
17,598 input tokens were video.

Now it is three calls:

```
ffmpeg -vn ─▶ mp3 ─▶ private `audio` bucket ─▶ signed url
                                                  │
      ┌───────────────────────────────────────────┴──────────────┐
      ▼                                                          ▼
 VIDEO leg — qwen3.7-flash                          AUDIO leg — qwen3.5-omni-flash
 sighted + deaf, OWNS the time grid                 hearing + blind
      └──────────────────────┬───────────────────────────────────┘
                             ▼   drift check ─▶ retries the AUDIO leg only
                    coherence call (text only, both summaries)
                             ▼
              merge ─▶ the SAME OmniAnalysisZodSchema parse
```

**Flag `ENGINE_AUDIO_SPLIT`, default ON.** Rollback is `ENGINE_AUDIO_SPLIT=false`.
**`ENGINE_VERSION` 3.22.0 → 3.23.0**, derived from that same flag so the prediction cache
partitions in BOTH directions (see §5).

Predecessor context: `docs/HANDOFF-2026-08-04-flash-everywhere.md` §6 (the spike that proved
feasibility). That doc lives on `lane/flash-apollo-calibrate` / PR #431 and is **not** required
reading for this branch.

---

## 2. The design decisions, and why

**The split lives INSIDE `analyzeVideoWithOmni`.** All 3 production call sites (`pipeline.ts`,
`/api/analyze`, `remix-runner`) and all 6 scripts are untouched. Both paths run the same
`assembleOmniOutput`, and the merged object goes through the **same `OmniAnalysisZodSchema` parse**
the unified read faces. That is the safety property: if the merge produces something novel it fails
at the same gate, rather than leaking a new shape into the aggregator, fold, Apollo, decode and the
filmstrip queue.

**flash owns the time grid** because it is the leg that can see scene cuts. omni's audio events are
projected onto that grid by **max timestamp overlap**; a segment no audio event overlaps is marked
`(no audio event reported for this window)` rather than borrowing a neighbour's description.

**The legs run in PARALLEL, which is why the third call exists.** Serialising them (omni first,
feeding flash the transcript) would grade coherence at higher fidelity — flash would hold real video
AND real audio text — but production omni is ~11-17s, so serial lands the Read *slower than the
thing it replaces*. `visual_audio_coherence` is the one field neither leg can perceive, so it gets
its own cheap text-only call (~0.003¢).

**Every failure path returns null and falls back to the unified read** — ffmpeg, either leg,
coherence, or a merged object the schema rejects. The split can never make a Read fail that would
otherwise have succeeded; it can only fail to make it cheaper.

**Nothing synthesises a missing figure.** A CTA one leg claims without a gradeable strength is
recorded in the rationale and NOT scored. The two emotion arcs are chosen between, never averaged.
`weakest_modality` stays derived by the existing schema transform rather than computed twice.

---

## 3. Measured live — `scripts/omni-split-harness.ts`

Four clips, four content shapes. The harness runs the unified read and the split back to back on
the same video and prints **both reads in full**, not just deltas.

| clip | what it exercises | result |
|---|---|---|
| 28s talking-head skit ×4 | the baseline | **53.1% cheaper**, latency flat, deterministic |
| 5s speech clip | short-form floor, fixed-bucket segment fallback | 33.9% cheaper, transcript identical |
| 11s music-only vlog | **no speech at all** — the null-not-zero rules | 39.0% cheaper, speech fields correctly null |
| 21s clip, **no audio stream** | the degradation path | ffmpeg exits 1 → **falls back**, as designed |

**Cost is the stable, unambiguous win: 33.9–53.4%**, every single run.

**Latency is UNCHANGED within noise, and that is the honest claim.** Per-run on the 28s clip
(unified → split): 14.0→14.2 · 14.0→11.4 · 11.2→10.8 · 9.8→10.6. Both paths jitter by seconds on an
identical input. The load-bearing result is that **adding ffmpeg (~1.2s) and a third call did not
regress it** — ffmpeg reads the signed video URL directly and writes mp3 to stdout, so the mp4 never
touches /tmp, and the two legs overlap.

**The split is deterministic where the unified read is not.** Identical numbers on all 4 baseline
runs. The unified read jittered on `emotion_arc` (5/6/7 points), `segments` (4/5),
`audio_perceptual_score` (85/88), and **truncated its own hook verbatim in 3 of 4 runs** where the
split returned the full line every time.

### Systematic perception deltas (28s clip, identical across all 4 runs — not noise)

| field | unified | split |
|---|---|---|
| `content_type` | comedy | talking_head |
| `visual_stop_power` | 8 | 6 |
| `text_overlay_score` | 6 | 8 |
| `weakest_modality` | text_overlay_score | visual_stop_power (**derived** — flips as a consequence of the two rows above) |
| `audio_hook_quality` | 9 | 8 |
| `visual_audio_coherence` | 9 | 10 |

These feed the fold and Apollo, which produce the score on the board. The owner took the flip on
this evidence.

---

## 4. ⚠️ The known cost, accepted — coherence on motion-driven content

`visual_audio_coherence` came in **9 → 5** on the music-only vlog and did not move after the prompt
fix below. This is inherent to grading coherence from TEXT descriptions: on a dance clip, sync is a
visual-temporal property a summary cannot carry.

The alternative is serialising the legs (§2), which costs latency. **If coherence turns out to
matter more than latency, that is the trade to revisit — it is one function (`runCoherence` in
`split/run.ts`), not a redesign.**

---

## 5. `ENGINE_VERSION` is derived from the flag — 3.23.0 on, 3.22.0 on rollback

Not a flat constant, deliberately. `ENGINE_AUDIO_SPLIT=false` returns the engine to the unified
read and **must return the cache with it** — otherwise a rolled-back deployment writes unified-era
reads under the split-era version and serves them to split-era rows. Deriving it also closes the
dashboard hole: toggling the env var in Vercel with no deploy still moves the version.

Four version-pin gates fired on the bump — `pack-seam-smoke` (×2), `audience-regression-gate`,
`aggregator`. That is them working; they now pin 3.23.0.

---

## 6. Infrastructure this needed

**A private `audio` bucket now exists on prod** — `audio/mpeg`, 50MB, service-role only, no RLS
policies (mirrors `filmstrips`). `videos` rejects audio mime types outright and `covers`, where the
original spike parked the mp3, is **PUBLIC**.

**⚠️ `ffmpeg-static` reaches the engine module graph for the first time.** It is in `next.config.ts`
`serverExternalPackages`, and `/api/filmstrip/extract` exists specifically to keep it out of the
main bundle behind one route. The engine graph is bundled by every route that imports the pipeline,
so this goes in via a **dynamic import** in `split/audio-track.ts`. tsc and vitest cannot see this
class of problem — **the prod build is the only gate that can**, and it passed.

---

## 7. Found on the way — NOT fixed here

**The unified omni read tells Apollo a 90%-dialogue video is 0% voice.** On the 28s skit it emits
`silence 0.05 / voiceover 0 / music 0` — the three ratios sum to **0.05**, not 1.0, on every run.

Its own prompt demands the sum (*"must sum to ~1.0 (±0.1)"*) and **the refine that enforces it
exists** — at `types.ts:637`. But that is the legacy *Gemini* schema. The schema actually in the
omni path, `qwen/schemas.ts:158`, is three bare `z.number().min(0).max(1)` with no cross-field
check, so the violation passes Zod in silence. Same shape as the guard that scanned one directory
while a paid route ran free: the guard exists, just not where the code runs.

Not cosmetic — `voiceover_ratio` carries **0.25 weight** in `audio-perceptual.ts`'s voice-mode
formula for `comedy`/`talking_head`, and `deepseek.ts:333` renders it straight into Apollo's user
message.

🔑 **Scope of the finding, stated precisely:** the *sum violation* is the real, defensible bug — a
hard invariant, unenforced. **"The split reads the mix correctly" is NOT established.** On the 5s
speech clip the two disagree the other way and both sum to 1.00 (unified `voice 1.0 / silence 0`,
split `silence 0.85 / voice 0.15`), and neither is obviously right.

**Deliberately out of scope**: adding the refine changes the *unified* read's behaviour (a violating
response would start failing Zod and burning a 60s retry) and needs its own measurement and version
call.

---

## 8. A defect the gap tests caught before it shipped

The first measurement was one clip. Widening to four found this: on the music-only vlog the split
returned `audio_hook_quality: null` where the unified read scored 7, because the audio-leg prompt
said to null it for *"music-only, ambient, silence"*. The original unified contract nulls it only
for *"slideshow or silent"* — **a catchy track IS an audio hook**, and music-driven content is most
of TikTok.

The prompt now separates SPEECH-derived fields (`voice_clarity`, `first_words_speech_score` → null
when nobody speaks) from AUDIO-derived ones (`audio_hook_quality`, `audio_hook_first_2s` → null only
in true silence). After the fix that clip reads `audio_hook_quality: 9` with the speech fields still
correctly null.

**The lesson worth keeping: one clip is not a measurement.** The same discipline that caught Apollo
grading 30 points harsher on flash caught this.

---

## 9. Gates

tsc **0 errors** · vitest **5290 passed / 0 failed** (3 unhandled errors are PRE-EXISTING, proven by
stashing) · **prod build exit 0** · eslint **0**. 41 new offline tests, all on the pure merge.

⚠️ `composer-fold-on-close.test.tsx` and `composer-stop-disc.test.tsx` are **flaky** in this
worktree — 5s timer timeouts, they fail intermittently in a full run and pass in isolation. Not
caused by this branch (the diff is engine-only). Do not chase them.

---

## 10. What is NOT done

- **Not measured on a slideshow.** `content_type: slideshow` is the one shape that exercises the
  `isSlideshowLike` drift exemption and the video-leg emotion-arc fallback together.
- **Not measured on a long video** (>60s). `LEG_TIMEOUT_MS` is 60s per leg and `SPLIT_LEG_MAX_TOKENS`
  is 8000; a dense 2-minute clip is the case that would find those ceilings.
- **No production telemetry yet.** `split: complete` logs cost, `extract_ms`, `legs_ms`,
  `segments_without_audio`, `verbatim_truncated`, `emotion_arc_source` and `cta_source` — worth a
  dashboard once real traffic runs through it, particularly `segments_without_audio`, which is the
  alignment's honest failure count.
