# HANDOFF — "flash everywhere" + the omni audio split

**Written** 2026-08-04, end of session · **Worktree** `~/virtuna-slot-b` · **Branch** `lane/flash-apollo-calibrate`

> ⚠️ **Every sha below was true when written and `main` moved FIVE times during this session.**
> `git fetch` and re-measure before acting on any of it. A co-session merged a PR out from under
> this work mid-session — see §5.

---

## 1. State at handoff

| Thing | Value (re-measure!) |
|---|---|
| `origin/main` | `470ef6ae` |
| Branch `lane/flash-apollo-calibrate` | `e22196bd` — **PR #431 OPEN, not merged** |
| Branch is behind main by | 6 commits (was 0 at branch time; main moves fast) |
| Unmerged commits on the branch | 1 (`git cherry`) |
| `lane/qwen-flash-swap` | `324b22ce` — **superseded, do not merge** (see §5) |

**Gates run on `e22196bd`:** tsc 0 errors · 5252 vitest passing · prod build compiles · eslint clean ·
both live harnesses re-run on the branch. The suite's **3 unhandled errors are PRE-EXISTING** —
proven earlier by stashing the diff and re-running to an identical count. Don't chase them.

---

## 2. What shipped to `main` already

`QWEN_CALIBRATE_MODEL` exists as a scoped seam and is **on `qwen3.7-plus`** in production, together
with `QWEN_APOLLO_MODEL` and `QWEN_UNBOUND_CHAT_MODEL`. Main also carries
`src/lib/audience/normalize-shares.ts` (a co-session's work) which repairs the persona-share
arithmetic inside `SynthSchema`.

**So production today runs three plus-holdouts.** PR #431 removes two of them.

---

## 3. What PR #431 does

Removes the Apollo and CALIBRATE holdouts by fixing **our own prompt/parse layer** — neither failure
was flash being incapable of the work.

### Apollo — citations restored
The output contract never actually *required* a `§` token. It said *"name the §2 lever"* and *"cite
section numbers ONLY inside the auditable fields"* — a restriction on **where** cites may go, which
plus read as a mandate and flash read as permission not to. Now demanded explicitly
(`apollo-core.ts` APOLLO_INSTRUCTION + the per-dimension JSON contract in `deepseek.ts`) and
**enforced**: fewer than `MIN_CITED_DIMENSIONS` (4 of 6) cited `lever`s sets a cite-specific retry
nudge; exhausting retries logs an error + Sentry rather than passing an uncited read off as the
framework-grounded product.

| | plus | flash |
|---|---|---|
| §-cites | `§2.1 §2.2 §2.3 §2.5` | **identical** |
| dimensions cited | 6/6 | **6/6** |
| danglers · prose leaks | 0 · 0 | 0 · 0 |
| composite, 5 runs | 52, 80, 80, 80, 80 | **49 ×5** |

Flash is the **deterministic** one. Part of the "28-point swing" originally blamed on flash was
plus's own thinking-mode jitter.

### CALIBRATE — the shape half
Main already fixed the **arithmetic** (`normalize-shares.ts`, same 0.5–1.5 guard band this session
derived independently). Missing was **shape**: flash emitted `personas`/`persona_weights` at the
**top level** in 2 of 7 runs — complete, correct, just unnested, which Zod read as `undefined`.
`liftFlattenedAudience()` lifts them; a no-op on a correct response.

Both calls also gained a **retry they never had**. `defaultSynthesize` was single-shot: any malformed
response threw to `calibration.ts` and became `{ error: "scrape_failed" }` **after** the Apify scrape
was paid for, blaming the scrape for a synthesis failure. Result on flash: **3/3, ~12× cheaper,
~2× faster**, persona quality unchanged.

---

## 4. 🚩 THE OWNER DECISION BLOCKING #431

**Apollo grades ~30 composite points HARSHER on flash.** It lands the hook band one step below plus,
and hook carries ~80% of the composite (§2.0a). Measured **49 vs 80** on one clip and **53 vs 82** on
a second — systematic, not noise (flash returned 49 on all five runs).

The reasoning is sound and the citations are identical, so flash is **stricter, not wrong**. But it
moves a number users see on every Read. **This is a product judgment, not a technical one, and it is
the only thing standing between #431 and merge.** Rollback is one env var either way.

### 🛑 And one holdout that must NOT be flipped
`QWEN_UNBOUND_CHAT_MODEL` stays on `qwen3.7-plus`. On the anonymous `/go` chat path flash opens with
a correct refusal sentence **and then writes the paid pack anyway — 5 of 6 runs leaked**. That is a
**revenue leak**, not a tone regression, and the one holdout no contract-tightening fixes. Cost is
not a reason to touch it. (Finding is a co-session's, recorded in `docs/MODEL-POLICY.md` on main.)

---

## 5. ⚠️ Process trap that cost real work this session

**A co-session merged PR #426 mid-session, at 3 commits — the "flash everywhere" fix was pushed to
that same branch minutes later and was NOT included.** `lane/qwen-flash-swap` (`324b22ce`) therefore
holds two commits that are **superseded**: their CALIBRATE repair duplicates main's
`normalize-shares.ts` in a worse-factored way, and rebasing them conflicts. **Do not merge
`lane/qwen-flash-swap`.** Everything worth keeping was re-derived on top of current main as #431.

Lesson, consistent with the existing memory: gate before the **push**, not before the merge, and
`git fetch` + re-measure before every action. Main moved five times in one session.

---

## 6. NEXT LANE — omni stops watching (feasibility PROVEN, rework NOT built)

The ask: omni is the only audio-capable model, so it should ingest **audio only**; flash is sighted
and should take the video. `scripts/omni-audio-split-spike.ts` (lands with #431, evidence-only)
measured it on a 27s clip:

| leg | prompt tokens | cost |
|---|---|---|
| A. omni on full video (today) | 17,598 = video 17,228 + audio 198 + text 172 | 0.1955¢ |
| B. omni on **audio only** | **351** = audio 198 + text 153 | 0.0240¢ |
| C. flash on the video | 17,403 = video 17,228 + text 175 | 0.0573¢ |

**B + C = 0.0813¢ vs 0.1955¢ → 58.4% saving.** omni's input falls 50×.

✅ `input_audio` with a signed URL works on `qwen3.5-omni-flash`, and omni **genuinely heard it** —
the transcript came back verbatim and correct, not plausible filler. Leg B carries the **same 198
audio_tokens** as leg A, so identical audio ingested with 17,228 video tokens gone, and
`prompt_tokens` includes audio_tokens so nothing is billed off-ledger. The figure is conservative:
`calculateCost` bills flat and ignores the 15,616 `cached_tokens` DashScope reported on leg C.

🔑 **The saving is 58%, not ~100%, and the mechanism matters:** the video tokens do not disappear,
they **move** to flash, which bills them ~3× cheaper ($0.03/M at ≤32K vs omni's $0.10/M).

### What still has to be solved (this is why it wasn't built)
1. **The schema interleaves the modalities.** Every `SegmentSchema` entry carries `visual_event` AND
   `audio_event` on **one time grid**, and `visual_audio_coherence` needs both. Two independent calls
   will not agree on segment boundaries. Design: **flash owns the grid** (it sees scene cuts), omni's
   audio events get **aligned onto it** by timestamp, and coherence is computed after the merge.
2. **Storage.** The `videos` bucket allows video mime types only. The spike parks the mp3 in
   `covers` — the one unrestricted bucket, and it is **PUBLIC**. Production needs a private `audio`
   bucket.
3. **Extraction on the critical path.** `ffmpeg -vn` must run somewhere. `ffmpeg-static` already
   ships and runs on Vercel nodejs (`src/app/api/filmstrip/extract/route.ts` is the pattern), but
   download + transcode + upload adds latency **that has not been measured**.
4. `ENGINE_VERSION` bump + re-validation of every downstream consumer (fold, Apollo, aggregator).

---

## 7. Tools left behind

- `scripts/calibrate-synth-harness.ts` (on main) — drives the real `enrichSignature()` on a **real**
  32-post @zachking payload rebuilt from `account_posts` + `account_snapshots`, **zero Apify spend**.
  Checks what Zod cannot: display-name presence/distinctness, archetype echoes, axis spread across
  the 10 reactors, vocab size, invariant sums. `QWEN_CALIBRATE_MODEL=… npx tsx …`
  🔑 It does **not** gate on "interests keys outside topic_vocab" — the shipped production baseline
  itself scores 3, so gating on zero would fail the very output treated as correct.
- `scripts/apollo-cite-harness.ts` (pre-existing) — `QWEN_APOLLO_MODEL=… npx tsx …`
- `scripts/omni-audio-split-spike.ts` (with #431).
