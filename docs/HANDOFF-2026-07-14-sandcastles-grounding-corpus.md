# Handoff — Sandcastles grounding corpus + the per-skill grounding rung

> **Date:** 2026-07-14 (rev 2 — session 2) · **Branch:** `lane/explore-c` · **Status:** data layer DONE · **generation rung WIRED but flags still OFF** · browser UAT NOT started.
> **One line:** the 532-video curated corpus is imported, normalized, and now actually *reaches the model* through per-skill slices — the pipe that was silently dropping its three richest fields is fixed, and a pile of honesty defects found by RENDERING it (not by reading it) are fixed too. Nothing is live: `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED` are still off.
>
> **▶ NEXT = flip the flags behind the mock sandbox and LOOK AT THE OUTPUT IN A BROWSER.** Everything below is verified offline (SQL, unit tests, a preview script). Not one grounded generation has ever been run.

---

## 0. Read this first — the lesson of session 2

Session 1 imported 532 rows and declared the data layer done. Session 2 audited it and found the corpus was **12% reachable**, that its three richest fields **never reached the model at all**, and that the receipt it would have printed on a card **asserted things that were false**.

Not one of those was catchable by reading the code, and every test was green the whole time. They were caught by **rendering the actual block from the actual corpus** — which took ten seconds once the tool existed:

```bash
npx tsx scripts/preview-grounding-slices.ts "how to grow on tiktok" tiktok --debug
```

**Use it.** It prints the exact string generation receives, and `--debug` shows which filter rejected each candidate (the difference between "found nothing relevant" and "silently rejected everything" is invisible otherwise). A grounding block has no surface a human ever sees — it is a string spliced into a prompt behind a flag inside a runner. **It will drift, and reading the source will not catch it.**

---

## 1. Decisions LOCKED

**A. Grounding stance:** grounded-by-default, honest raw fallback. Ladder: `personal → curated corpus → live scrape on miss → ungrounded (labeled)`. Never fabricate a source.

**B. Per-skill policy:** hooks/script = reference-required (scrape on miss) · ideas = reference-first · chat/refine = raw-native · remix/discover = grounded-only already · read/react = N/A.

**C. Internal only:** curated rows are generation context, never shown verbatim. We cite the real public video, not Sandcastles.

**D. One teardown → per-skill SLICES** (shipped, §3): hooks ← the madlib · ideas ← belief↔reality · script ← the timed beats.

**E. 🆕 WARRANT vs CLAIM (owner call, session 2).** Two different questions:
- **Warrant** (may this row ground at all?) — a **curated** row is admitted because *a human picked it into a teaching collection*. That is its warrant. It is admitted **regardless of its metric**. A **scraped** row has no human in the loop, so it must clear the §12 bar (`views÷followers ≥ 3×`) — that metric is the only thing separating a lesson from a random video.
- **Claim** (what may we say about it?) — only a row clearing 3× may be called **proven**, with its number. Everything else is a **curated exemplar**: real warrant, no performance claim.

This is why all 532 videos ground generation while nothing lies. **Do not collapse these two back into one filter.**

**F. 🆕 The outlier score is `views ÷ followers`** (owner-confirmed, and corroborated: `views/score` implies a stable, time-growing follower count per creator — @personalbrandlaunch 49k→104k across 2024-25 in posted_at order; @thebranding.ai flat ~33k). Hence `baseline_label = 'vs followers'`.

---

## 2. State of the corpus (verified)

**532 rows** in `public.outlier_teardowns`, Supabase `qyxvxleheckijapurisj` (prod). `source_pool='curated'`, `extraction_version='sandcastles-import-v1'`, `trust_weight=1.5`, `proof_captured_at=NULL` (**evergreen — exempt from the 90-day freshness filter**). All embedded (768-d `text-embedding-v3`). Import completeness was PROVEN in session 1 (platform live set == captured == DB rows; 0 missed, 0 extra).

| Platform | Rows | Proof-grade (≥3×) | No score at all | Median score |
|---|---|---|---|---|
| instagram | 333 | 209 | 42 (12.6%) | 7.5× |
| tiktok | 177 | 65 | **94 (53.1%)** | **11.3×** |
| youtube | 22 | 14 | 0 | 8.0× |

**524 usable** (8 videos have no analysis — Sandcastles' own `failure_reason`, source went private/deleted; they are signal-less and dropped at retrieval).

⚠️ **The TikTok "no score" is a gap in SANDCASTLES' data, not a scrape failure.** Only 18 TikTok videos actually *failed* 3×; the other 94 were never measured (their score needs a follower count, which is harder to get on TikTok). Note the median: the TikTok videos that ARE scored run 11.3×, the best of the three platforms. These are good videos missing a number. See §6 (follower backfill).

---

## 3. What session 2 built

**Per-skill slices — the main win** (`src/lib/grounding/prompt.ts`, rewritten). `formatCorpusForPrompt(examples)` → `buildCorpusBlock(examples, skill)`.

Before, **all three skills got a byte-identical one-line summary** that dropped the madlib, the belief↔reality tension, and the beats. `RetrievedExample.idea` had **zero readers in the entire codebase** — extracted, stored, embedded, never once used. Now:

- **hooks** → leads with `hookTemplate` (the MADLIB): *"MADLIB: My number one tip for [achieving goal] and no it's not [common advice A]…"* + what it ran as + why + receipt. This is the differentiator: it reached the *card* but never the *model*.
- **ideas** → leads with `idea.belief ↔ idea.reality` + evidence + angle + format.
- **script** → leads with `template.beats`: the real named beats with **real timings** (`The Hook & Anti-Pattern (0–5s) … → The Reveal (15–21s) …`) + `use when` (their format_reasoning).

`buildCorpusBlock` returns `{corpus, used}` — the caller must hand `used` to the runner, because `sourceIndex` is resolved **positionally** against that array.

**Everything else session 2 fixed** (all were silent, all were green):

| Defect | Was | Now |
|---|---|---|
| **Key fork** | curated jsonb used Sandcastles' names (`common_belief`, `narrative_structure`); our code read `belief`, `skeleton` → **`undefined` on all 532 rows**, typechecked clean | migration rebuilds both onto our shapes from the lossless `teardown` raw column; raw jsonb is now typed `unknown` and **zod-parsed** at the boundary — a drift warns LOUDLY |
| **Slug fork** | `skit_humor` (curated) vs `skit` (ours) — one column, two vocabularies | normalized; enums grown in `types.ts` for genuinely-new concepts |
| **Corpus 12% reachable** | `gather-for-run` bailed unless `platform==='tiktok'` (because the SCRAPE is TikTok-only) — but the read-back is just pgvector. Corpus is **majority Instagram**. An IG creator got **zero** grounding, permanently | read-back and scrape **decoupled**: read any platform, scrape only TikTok. On a non-scrapable platform a partial cache is USED, not discarded |
| **Similarity floor mis-tuned** | 0.65, calibrated on a **22-row test corpus** — on the real one it sat *inside* the true-positive band, rejecting 39×/48×/160× dead-on-topic outliers | **0.58**, measured: on-topic 0.58–0.68, off-topic ≤0.54. Off-topic still correctly grounds nothing |
| **`0.0×` receipts** | 136 rows had `outlier_multiplier=0` → card would read *"proven by @x · 0.0× · 820K views"*. Zero is a missing measurement, not a result | nulled in data + coerced at the boundary |
| **`458× curated`** | `baseline_label='curated'` — that's the source POOL, not a basis. Measures nothing | `'vs followers'` (§1F) |
| **Sub-1× "proven"** | 20 rows scored **below 1×** (fewer views than followers — they *underperformed*) | never printed; those rows render as *curated exemplar* with no number (§1E) |
| **Grounding evicting the creator** | `corpus` is fenced inside `BUNDLE_CHAR_CAP=4000`, and on overflow the assembler **drops PROFILE ROLES first** (flops → wins → voice). An unbudgeted block would starve the creator's own voice to make room for a stranger's video | `CORPUS_CHAR_BUDGET=1800`, trims from the tail, hands back `used` |
| **`"(structure)"`** | one dead row had a present-but-EMPTY template — truthy, so a presence check kept it and the renderer emitted the literal string `"(structure)"` as a grounding line | `hasReusableSignal` checks CONTENT, not presence |

**Result:** reachable pool **63 → 524 rows**.

| Query | Platform | Session start | Now |
|---|---|---|---|
| how to grow on tiktok | tiktok | 2 | **6** |
| how to grow on tiktok | instagram | **0** | **6** |
| personal branding for founders | instagram | **0** | **3** |
| german shepherd puppy training | instagram | 0 | **0** ✓ (still correctly grounds nothing) |

---

## 4. ▶ NEXT: flip the flags and LOOK (the whole point)

**Nothing below has ever been run.** All of §3 is verified offline. The one thing that matters — *does the model, handed a madlib, actually instantiate it for this creator instead of ignoring it or copying the source's words?* — is unknown.

1. Arm the **mock skill sandbox** (see `mock-skill-sandbox` memory) so no paid engine fires.
2. Set `GROUNDING_HOOKS_ENABLED=true` / `GROUNDING_IDEAS_ENABLED=true` / `GROUNDING_SCRIPT_ENABLED=true` in `.env.local`.
3. Run hooks, ideas, and script **in the browser**, on **both** an Instagram and a TikTok profile.
4. Verify with your eyes, not with tests:
   - the generated hook visibly **instantiates a proven madlib** (not copies the source's words, not ignores it);
   - the **receipt renders live on the card** (`parseProofProp` is wired through all three stream hooks — #287);
   - a **curated exemplar is never described as proven/viral** in the model's prose;
   - ideas show real belief↔reality tension; script beats follow the retrieved rhythm.

⚠️ **Cost note before any prod flip:** the TikTok pool is thin (65 proof-grade), so TikTok runs will often miss the cache and **fall through to a live Apify scrape** (real money per run). Instagram is the strong path. Consider enabling for Instagram first, or run the §6 backfill.

---

## 5. Then: the deferred work (ranked)

1. **Assembler drop-order is backwards** (`src/lib/kc/assembler.ts`). On overflow it drops the creator's profile before it trims the corpus. That is exactly wrong: the corpus is the **redundant** tier (six proven sources still teach with four), the creator is not (there is only one). Inverting this is the *right* fix and would let the ideas slice carry more than 1–2 examples. `BUNDLE_CHAR_CAP=4000` is an admitted untuned placeholder — re-measure it and `CORPUS_CHAR_BUDGET` together (audit lever A3).
2. **The visual-hook SEMANTIC mismap** (not started). The import wrote Sandcastles' `visual_layout_category` (a **setting**: `in_world_vlog`/`studio_set`/`greenscreen`) into our `visual_hook` column, which means **first-frame device** (`crash-zoom`/`match-cut`). *Different dimensions.* Nothing reads it today, so it is harmless — and lethal the moment anyone wires "shootability". Fix = new `visual_setting` column + `VISUAL_SETTINGS` vocab + backfill from the raw + null the bad column + **DROP/CREATE `match_shared_teardowns`** (its `RETURNS TABLE` cannot change via `CREATE OR REPLACE` — the existing migration says so) to return `visual_setting` + `editing_style`, then a "shoot it as:" line in the hooks/script slices, gated on non-null. `editing_style` ← their `visual_layout_type` IS the right dimension and is already correct.
3. **Follower backfill** (§6) — upgrades ~94 TikTok rows from *curated exemplar* to *proven by 11×*.
4. **Schema unification (§1D)** — teach `extract.ts` to emit the Sandcastles taxonomy (`format_flavor`, `format_reasoning`, timed beats) so our OWN scrapes produce the same shape. Add fields, **not** their 2-level nesting (our flat soft-vocab is deliberate — §13 rejected rigid CHECKs).
5. **`format_reasoning` → the KC brain.** Do NOT paste their text into the brain (their work product; and the KC is byte-stable Tier-1 cache). Instead read their 105 collections and hand-author OUR format-selection layer. ⚠️ **Blocked:** the KC regen pipeline is broken on `main` — `.planning/corpus/*.md` sources don't exist there.

---

## 6. The follower backfill (optional, high value, not started)

94 TikTok rows have no score. All 94 have views, a handle, and real craft content — **91 distinct creators**. Everything needed already exists and is the identical path the live orchestrator runs:

- `apify-provider.ts` → `scrapeProfile(handle) → followerCount` (TikTok/IG/YT actors)
- `outlier-gate.ts` → `accountMultiplier(views, followers)` → `{multiplier, baselineLabel:'vs followers'}`

Write it like `scripts/backfill-teardown-embeddings.ts` (dotenv + tsconfig-paths). Run `--dry` first. Expected: TikTok proof-grade **65 → ~140-150** (median is 11.3×, so most should clear 3× comfortably). Same for the 42 unscored IG rows.

---

## 7. Key code references

- `src/lib/grounding/prompt.ts` — **the per-skill slices + the two-warrant receipt.** Start here.
- `src/lib/grounding/retrieve.ts` — read-back; `isProofGrade` (the §12 claim bar) vs `isAdmissible` (the warrant, §1E); `hasReusableSignal`; the re-measured 0.58 floor.
- `src/lib/grounding/gather-for-run.ts` — the ladder; read-back ≠ scrape (platform decoupling).
- `src/lib/grounding/types.ts` — soft-vocab SSOT + **zod parse guards** (`parseIdeaFacet`/`parseTeardownTemplate`) + `TeardownBeat`.
- `src/lib/tools/runners/build-proof.ts` — sourceIndex → the on-card receipt; only a ≥3× row may state a multiplier.
- `src/lib/grounding/embedder.ts` — **LOCKED embed formula.** Do not touch. (Normalization did not change `idea.angle`, so embeddings are byte-stable — no re-embed needed.)
- `scripts/preview-grounding-slices.ts` — **the look-at-it gate. Use it.**
- Migration: `supabase/migrations/20260714120000_normalize_curated_teardowns.sql` (applied to prod).

## 8. Gotchas

- **Flags off by default** — importing rows does nothing until the runners' env flags flip. The deliberate safety gate.
- **Curated = evergreen** (`proof_captured_at=NULL` passes freshness forever). That is what makes it a durable floor.
- **`vitest` does NOT load `.env.local`** — scripts use `dotenv` explicitly.
- **Run tests with `node ./node_modules/vitest/vitest.mjs run`** — `npm test` prints fake results (rtk shim).
- **Pre-existing failure:** `src/app/api/tools/remix/run/__tests__/route.test.ts` fails on a clean tree too. Not ours.
- **Every new card prop = 4 touchpoints:** schema → runner → parse → toBlocks. A prop that skips `toBlocks` typechecks, passes every persisted test, and does NOTHING on the live stream.

## 9. How the corpus was scraped (for re-scrapes)

Sandcastles is a React SPA on `app.sandcastles.ai/api/*`. Owner has a free Starter account; log in via Google SSO in Playwright. Requests need two headers the app injects (a bare fetch gets 403): `authorization: Bearer <JWT>` (~7d) and `x-firebase-appcheck: <JWT>` (~12h). Capture them from a real authenticated request via the Playwright network trace, seed into `window.__H`, then loop the API from `browser_evaluate`.

- `GET /api/collection/list?query=&sort_key=name&sort_direction=0` → 105 collections
- `GET /api/collection/videos?collection_uuid=<uuid>` → video uuids
- `GET /api/channel/library_video?uuid=<uuid>` → **the full teardown** (all 5 analysis tabs)
- `POST /api/channel/export_videos` → 403, plan-gated. Don't bother; the read endpoints give everything.

Local artifacts in `.playwright-mcp/` (gitignored): `sandcastles-corpus-raw.json` (3.9 MB, all 532 raw records — source of truth for re-transform), `transform.js`, `import-sandcastles.js`, `smoke.js`, `corpus-viewer.html`.
