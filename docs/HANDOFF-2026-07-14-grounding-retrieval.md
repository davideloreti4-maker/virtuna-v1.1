# Handoff — Grounding retrieval: hooks now rank on STRUCTURE (2026-07-14, session 3)

**Status:** ✅ PR #297 **MERGED to `main`** (squash `06634abb`). Both migrations **applied to prod**.
Grounding flags remain **OFF** in prod — nothing user-facing changed.

**Full suite on main: 3681 passing, 0 failures.** (The `remix/run/route` failure seen during the
session was a stale-lane artifact and does not exist on `main`.)

---

## 0. The one-paragraph version

The owner observed that *"when a skill references a video it doesn't need to be a 1:1 reference —
it's not about the exact words but why it works and the structure."* He was right, and the code
assumed the opposite. Measuring that claim found **hooks grounding was effectively dead** (8 of 10
real asks retrieved nothing), and chasing it further found the **proof receipts were naming a
baseline we never recorded**. Both are fixed. What is still unproven is whether grounding actually
makes a *better hook* — that is the next decision, and it needs a human eye.

---

## 1. What shipped

### 1a. Hooks retrieve on structure, not subject

`hook_template` is a **MADLIB** — a hook with the topic lifted out and replaced by slots. That is an
abstraction *over* the subject by construction. But retrieval selected madlibs by **cosine over a
topical embedding of the FILLED-IN line** (`embedder.ts` embeds `spoken_hook`, not `hook_template`),
then hard-dropped everything under a 0.58 floor. **The pipeline abstracted the topic out to build the
template, then picked the template by the topic it had just removed.**

Measured on the live 532-row corpus (`scripts/probe-hook-transfer.ts`):

| | before | after |
|---|---|---|
| real asks that grounded on **something** | **2 of 10** | **10 of 10** |
| distinct corpus rows ever reachable | **9** | **50** |
| archetypes per block | 2 (of 14) | **6** |

- The floor **deleted the most on-topic row in the corpus**: "personal branding for founders" peaked
  at 0.576 against a 0.58 floor, and the 0.576 row was *literally a personal-branding video*.
- The **off-topic control beat every real query but one** — "carbonara recipe" scored 0.673 and
  shipped. The floor never separated relevant from irrelevant; it only detected whether the corpus
  happened to contain your subject.
- The floor was **calibrated on a corpus production never queries** — measured *unfiltered*, while
  every runner passes `filterPlatform`. Same query: 0.629 across all 532 rows, 0.576 across the 177
  TikTok ones. ⚠️ **Always re-measure per platform.**

**The fix:** `skill` now selects the **RANKING AXIS**, not merely the rendered slice.

| skill | axis | why |
|---|---|---|
| `hooks` | **structural** (`src/lib/grounding/rank.ts`) | archetype round-robin over the WHOLE corpus, **no floor, no platform gate**. Topic demoted to a tiebreaker *within* an archetype — it picks *which* exemplar you get, never *whether*. Proof outranks topic. |
| `ideas` | topical, **UNTOUCHED** | 🔒 `belief ↔ reality` **is** subject-bound. A claim about what a specific audience believes is worthless cross-niche. **Do NOT make the three skills symmetric — that is the mistake.** |
| `script` | topical, untouched | probably wants structural-on-`format` (beat *timing* is genuinely platform-bound) — **but measure first.** |

The platform gate went too, for hooks only: a madlib is a madlib, and the argument that carries a
hook across niches carries it across platforms. That gate was hiding all **333 Instagram rows** from
every TikTok creator — two-thirds of the corpus, excluded before cosine even ran.

Escape hatch: **`GROUNDING_HOOKS_RANK=topical`** reverts hooks to the old path with no deploy.

### 1b. The proof receipts named a baseline we never recorded

Found by running the **first-ever grounded-vs-ungrounded A/B** (`scripts/ab-grounded-hooks.ts`). A
receipt came back reading `@gushmedia.net · 6093× vs followers`, which was too absurd to ignore.

- **0 of 532 curated rows carry a `follower_count`.** Not one.
- **396 printed "N× vs followers" anyway.** 56 claimed >100×. Top claim: **20,154×**.
- The raw Sandcastles record has exactly ONE metric — **`outlier_score`** — and **no follower field
  at all**.
- The card told users `proven by @colinandsamir · 1226.3× vs followers · 60M views` — for an account
  with well over a million followers, where a follower ratio is nearer 60×.

**Owner, 2026-07-14: `outlier_score` is measured against the creator's PAST VIDEO VIEWS.**

So **the number was always real — only its NAME was invented.** Read correctly ("1226× the views that
creator's videos usually get") it is both true and a *stronger* claim than the one we faked, and it
is the standard creator definition of an outlier.

**The fix (migration `20260714150000`, APPLIED to prod):**

- The basis is now carried **PER ROW** — the corpus has **two honest bases** and the label is what
  distinguishes them:
  - `curated` → **`vs their usual views`** (Sandcastles `outlier_score`; views ÷ their own past videos)
  - `scraped` → **`vs followers`** (computed by `outlier-gate` from a follower count we actually captured)
- `hasFollowerBaseline` → **`hasKnownBaseline`**. Proof requires a **NAMED basis + ≥3×**, not
  specifically a follower one.
- 🔒 **`receipt()` prints NO number for a row that cannot name its basis.** A bare multiplier is not a
  neutral fact — it is a boast with nothing behind it. **This guard is the one that would have caught
  the bug in the first place. Keep it.**

Verified in prod: 396 curated rows carry a real score against a named basis; the 136 with no
measurement carry no label and no number. **Zero rows claim a follower ratio.**

### 1c. Two defects found only by RENDERING the block

Neither was visible in the source. Both would have shipped silently green.

1. **The corpus budget was eating the fix.** 1800 chars fits exactly TWO examples after the ~700-char
   header — the new six-archetype spread was being truncated to 2 on the way to the model. Now
   per-skill (`hooks: 2800`), **measured** against `BUNDLE_CHAR_CAP`.
2. **`hook_template` and `spoken_hook` were the only UNCLIPPED fields in any renderer.** Budget is
   spent tail-first, so one chatty row didn't merely render long — it **evicted the archetypes behind
   it** (6-shape spread → 3).

⚠️ **The budget ↔ bundle hazard is real and still only guarded, not removed.** `assembler.ts` §4a pops
the creator's **PROFILE roles** from the tail when the bundle exceeds `BUNDLE_CHAR_CAP` (4000) — so an
oversized corpus evicts the creator's own voice. The margin is now asserted by test
(`prompt.test.ts` → "the profile-eviction guard"). **The real fix, which `prompt.ts` itself names, is
to invert the assembler drop-order so the corpus trims BEFORE the profile** (six sources still teach
with four; there is only one creator). **Not done.**

---

## 2. 🔴 The lessons (these are the load-bearing part)

1. **A surface you cannot cheaply LOOK AT will drift, and reading the source will NOT catch it.**
   Every defect this session was invisible in code review and green in CI. All were found by
   *rendering the block* or *running the pipeline*.
2. **ASSERT THE WIRE, NOT THE TYPE.** `gather-for-run` never forwarded `skill` to `retrieve`. The
   runners already passed it. It typechecked. Every test stayed green. (Same trap as `toBlocks()`
   hand-building props.)
3. **A confident comment is not evidence.** The migration that introduced the baseline bug wrote that
   the follower basis was *"owner-confirmed"* and *"corroborated against the data rather than taken on
   faith."* Both were false — there was no follower data to corroborate against. **The bug survived
   precisely because the comment claimed it had been checked.**
4. **Re-measure PER PLATFORM.** The floor was tuned on an unfiltered corpus that production never
   queries.

---

## 3. ▶ NEXT — ranked

### 3.1 🎯 THE DECISION GATE: does grounding actually make a BETTER hook?

**This is unresolved and everything downstream forks on it.** Run `scripts/ab-grounded-hooks.ts`.

At n=2 grounding did **not** clearly win:
- Run 1 favored grounded (9/10 and 8/10 vs a best of 6/10).
- Run 2 favored **ungrounded** (two 10/10s vs a best of 9/10).
- ⚠️ **The band score is our own Flash SIM.** Using it to judge our own grounding is circular. **It is
  not independent evidence.**

**What the thesis DID prove, visibly:** a fitness creator's madlib (`@fitxfearless`) produced a
genuinely good *design-retainer pricing* hook, and Instagram rows now reach TikTok creators.
**Cross-niche and cross-platform transfer is real.**

**Recommended method:** 6–8 asks across niches, both arms, pairs written to a file **with the arms
unlabeled**, and the *owner* reads them blind. Do not let the model grade its own homework.

**If grounding wins** → fix ideas + script (§3.2, §3.3). **If it doesn't** → that is the most important
fact in the project, and the moat needs rethinking before more is invested.

### 3.2 `ideas` and `script` still ground on NOTHING for most asks

They are still on the old shared topical path — same 8-in-10 failure. The preview says so plainly:

```
IDEAS SLICE  — rank=topical · NO EXAMPLES
SCRIPT SLICE — rank=topical · NO EXAMPLES
```

- **`ideas`** → needs a **recalibrated floor, measured WITH the platform filter on**. It is mis-set for
  exactly the same reason hooks was, and unlike hooks, ideas still *depends* on it. 🔒 Do **not** give
  ideas the structural axis — `belief ↔ reality` is genuinely subject-bound.
- **`script`** → needs its own measurement before choosing an axis. **Blocked on §3.3.**

### 3.3 🐛 `template` JSONB silently fails its schema

Some rows log `template JSONB failed its schema — dropping (keys: name,beats,slots,flavor,guidance,skeleton)`.
Those keys look *correct*, so something is off inside the parse (likely the `beats` item shape).
**`template.beats` IS script's entire payload** — so script grounding is degraded even on the rare
query where it retrieves anything. **Fix this before measuring script.**

### 3.4 Grounding leaks craft slugs into `mechanism`

In the grounded arm, `mechanism` began leading with `"Open Loop:"`, `"Pattern Interrupt:"`,
`"Transformation Promise:"`. `blocks.ts` D-04 says mechanism must be **"prose, NEVER a craft slug."**
The ungrounded arm emits prose correctly. **Grounding is teaching the model to *label* instead of
*explain*** — likely mimicking the `[archetype]` tags in the corpus block. Also: run 1 returned 4
hooks instead of 5.

### 3.5 Invert the assembler drop-order

See §1c. Corpus should trim before profile roles. `prompt.ts` already calls this "the real fix."

---

## 4. Tools (all committed — use them, don't rebuild them)

| script | what it answers |
|---|---|
| `scripts/probe-hook-transfer.ts` | Census + reach + the before/after table. **The re-measure tool** — run after ANY floor/ranking change. |
| `scripts/preview-grounding-slices.ts` | Renders the REAL per-skill block the model receives. **Retrieves per skill** (the axes now differ — retrieving once and rendering thrice would lie). |
| `scripts/ab-grounded-hooks.ts` | Grounded vs ungrounded, same ask, real generation. Grounding is the only variable. |

All need `.env.local`: `DASHSCOPE_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + URL.

---

## 5. ⚠️ Repo hygiene note

`lane/explore-c` is **DIVERGED and stale**: local had 46 commits origin lacked, origin had 6 local
lacked, and it sat 41 behind `main`. Its content is on `main` via squash-merges under different SHAs.
**PR #297 was rebased onto `origin/main` (4 clean commits, zero conflicts) and merged there.**
**Do not branch off `lane/explore-c` — branch off `main`.**
