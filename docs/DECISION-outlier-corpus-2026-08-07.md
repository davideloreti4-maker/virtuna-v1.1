# DECISION — The outlier corpus is CURATED, SHARED and STRUCTURAL

> **Owner call, 2026-08-07.** Supersedes the per-user, niche-pulled outlier model implied by
> `/api/discover` + `/api/tools/explore` as the *front door*. Those routes are not deleted —
> they become an on-demand power feature (see §6).
>
> Status: **direction agreed, not yet built.** No code changed. Product shape sketch:
> `docs/mockups/maven-product-shape-2026-08-07.html`.

---

## 1. The decision

Maven's evidence layer is a **small, curated, editorially-controlled library of proven
structural formats**, decoded once and served to every user — not a per-user, per-niche scrape.

- **Curated, not pulled.** A human picks what enters the library. Quality over volume.
- **Structural, not topical.** What is stored is the *decode* — `hook_pattern`, `structure`,
  `the_turn`, `emotional_beat`, plus the `repeatable[]` lane. Topic is stripped. `luck[]` is
  stripped (already enforced at the type level by D-01 in `src/lib/engine/remix/decode-types.ts`).
- **Shared, not personal.** The same library serves every user, in every niche.
- **Presented as intel, not as a feed.** Six hand-picked formats, dated, with a stated reason —
  not sixty scraped tiles the user has to sort.

Personalisation moves **downstream** of the library: same intel for everyone → *your* adaptation
→ *your* audience's verdict. That split is the whole architecture.

---

## 2. Why this is right

**It resolves a contradiction in the earlier framing.** We argued that what transfers between
domains is *structure*, because the decode strips topic and luck. If that is true, then niche is
irrelevant to **selection** — it is only relevant to **adaptation**. Pulling outliers by niche
was importing a constraint the transfer thesis had already dissolved.

**It makes the Board's quality an editorial problem, not a scraping lottery.** The load-bearing
assumption of the whole product shape is that the Board is genuinely good every time it
refreshes. You cannot QA an on-demand scrape. You can absolutely QA a set of 30–50 formats.

**It fixes the cost curve.** Decode cost goes from `O(users × pulls)` to `O(formats)`. A format
decoded once is served to everyone forever. This removes Apify from the critical path — see the
standing note that Apify runs on rotating free accounts with a hard monthly cap, where a cap-out
masquerades as "check your handle is public." That failure mode must never be able to empty the
front door.

**It is a proprietary asset.** A per-user scrape is a commodity — anyone can run the same actor.
A curated, decoded, cross-domain-validated format library is something we own, that compounds
with taste rather than compute, and that a competitor cannot scrape off us.

**It raises the pitch.** A feed says *"here is everything, you sort it."* Intel says *"we found
this for you."* Scarcity plus curation reads as premium; volume reads as a search tool. Six
hand-picked formats support a higher price than six hundred scraped ones.

**It makes the product demoable and deterministic.** Onboarding, marketing, sales and the funnel
all get predictable content. The wow moment stops depending on a live scrape succeeding.

---

## 2b. The seed already exists — the 532-row corpus (owner call, same session)

We do not build the library from scratch. It is seeded from the **Sandcastles grounding corpus**
already in the repo: 532 human-curated videos, imported, normalised, and classified into
**14 hook archetypes** (`src/lib/grounding/`). This is the strongest possible starting set — the
rows were picked into a teaching collection precisely *because* they demonstrate structure that
holds across domains.

**`rank.ts` already implements the Board's selection rule.** It selects **round-robin across
archetypes** rather than top-N by similarity — "six examples, six ways to open" — with topic as a
tiebreaker, not a gate. That is exactly six tiles of six distinct shapes. The selection logic does
not need writing; it needs pointing at a surface.

Three constraints inherited from the corpus work, none of them negotiable without a new owner call:

- **Decision C — curated rows are internal.** They are generation context and are *never shown
  verbatim*; we cite the real public video, not Sandcastles. **Consequence for the Board:** a tile
  renders *our decode* of the public video. It must never render the curated teardown prose, and
  the source link points at the public video.
- **WARRANT vs CLAIM.** A curated row is admitted to *ground generation* because a human picked
  it, regardless of metric. Only a row clearing the 3× bar may be called **proven** and carry its
  number. **Consequence:** the Board surfaces **only rows clearing 3×**, so every tile carries a
  number and there is no second-class tile to explain. The sub-3× rows keep doing their existing
  job as generation grounding.

### Measured 2026-08-07 (`public.outlier_teardowns`) — the cadence question is ANSWERED

| Measure | Value |
|---|---|
| Rows total | 532 |
| Carry an `outlier_multiplier` | 396 (**136 have none**) |
| Clear 3× | 288 |
| **Printable band (3×–50×)** | **211**, avg 14.7×, covering **all 13 archetypes** |
| Absurd tail | 46 at 50–200×, 31 above 200×, **max 20,154×** |
| Have `why_it_works` + `template` | 524 of 532 |

**211 printable rows supports a weekly feed comfortably** — six per week is 35 weeks before a
repeat, before any rotation or personalisation, and before adding a single row. All 13 archetypes
appear in the printable band, so `rank.ts`'s round-robin still yields six distinct shapes weekly.

**Cap the printable band at 50×.** A "20,154×" badge destroys more credibility than it buys.

### ⚠️ Two findings that CONTRADICT the session-2 handoff — resolve before any number ships

- **`follower_count` is NULL on all 532 rows.** `views ÷ followers` cannot be computed from this
  table at all. Whatever produced `outlier_multiplier`, it was not that.
- **`baseline_label` is only ever `"vs their usual views"` or NULL — never `"vs followers"`.**
  The handoff records decision F as owner-confirmed `views ÷ followers` →
  `baseline_label = 'vs followers'`. The data disagrees. **Until this is settled, every tile would
  print the wrong basis.** Either the decision was never applied to the import, or it was reversed
  and the handoff is stale. This needs an owner call, not a guess.

⚠️ **Grounded generation has never actually run.** `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED` were
still off as of the session-2 handoff, which states plainly that not one grounded generation had
ever been executed. Flip the flags behind the mock sandbox and *look at the output in a browser*
(`scripts/preview-grounding-slices.ts`) before anything is built on top of this. That handoff's own
lesson: the corpus was 12% reachable and its three richest fields never reached the model, and
every test was green throughout.

## 2c. Domain is never shown to the user (owner call, same session)

No "proven in 4 domains", no "unused in Money", no donor-niche label anywhere on any surface.

**Why:** naming the donor domain manufactures an objection the user did not have. "This worked in
fitness" invites "but I'm not in fitness" — the exact opposite of a smooth, magical experience.
Cross-domain transfer is machinery, and machinery stays under the floor. The tile says what the
format is, what it scored, and why it works. Nothing about where it came from.

This also simplifies the tile: thumbnail · multiplier · format name · why it works · one action.

## 3. What a format record holds

Not specced as a migration yet — this is the shape the decision implies.

| Field | Why |
|---|---|
| `decode` | The 4 beats + `repeatable[]`. The transferable part. `luck[]` stored for review, never passed to adapt. |
| `source` | The origin video + its measured multiplier + date. This is the credibility. Must stay real. |
| `proven_in[]` | Domains where it has been observed working. Drives the "proven in 4 domains" line. |
| `feasibility` | Can a phone-and-bedroom creator execute it? The missing filter — see §5. |
| `first_seen` / `retired_at` | Lifecycle. A format has a shelf life; see §4. |
| `uses` | How many users have adapted it. Feeds saturation control. |

---

## 4. The two real risks

**Saturation — the self-defeating dynamic.** A shared library means every user sees the same
formats. At scale we *cause* the saturation we are supposed to detect: 5,000 users all remixing
format #7 in the same week is how a format dies. Mitigations, in order of cheapness:

1. Rotate — each user sees a *subset*, not the whole library, varied by cohort
2. Retire on `uses` threshold, not just on age
3. Grow the library faster than the user base
4. Track per-domain uptake and stop showing a format to a domain that has already absorbed it

This is the risk that actually scales with success. It should be designed for before launch, not
after.

**Freshness is a promise.** "This week's intel" only works if something is genuinely new this
week. A static library breaks the habit loop the returning-user Board depends on. Needs a real
cadence — a small number of new formats per week, dated and marked. If we cannot sustain the
cadence, the Board must not imply one.

Lesser risk: **coverage.** A user whose domain fits none of the current formats. Structural
abstraction makes this rarer than it sounds, but there needs to be a floor.

---

## 5. Still open

- **Feasibility signal.** Nothing today scores whether a creator can actually execute a format.
  Ranking should be `predicted stop × can-they-make-it`. Being shown something unexecutable is
  the #1 reason recommendations feel useless.
- **Does the decode survive cross-domain adaptation?** This is the one empirical assumption the
  whole design rests on and it is cheap to test: take 20 decodes, adapt each across three
  unrelated domains, read the output. Do this before building the library.
- **Library size and cadence numbers** — how many formats at launch, how many new per week.
- **Who curates**, and against what bar.

---

## 6. What happens to the existing routes

`/api/discover` and `/api/tools/explore` are **not** deleted. They stop being the front door and
become an **on-demand power feature**: "analyse any video / any competitor / any handle." That is
a better home for Apify cost — user-initiated, already metered at 5 credits, and a legitimate
premium capability rather than critical-path infrastructure.

`outlier-compute.ts` (median baseline × half-life decay → multiplier) remains the detector used
to *find candidates for the library*. It moves from a per-request path to an internal curation
tool.

---

## 7. Consequences for surfaces

- `/discover` and `/competitors` stop being nav destinations — the Board is the discovery surface
- The Board's tiles are **formats**, not videos: a name, a multiplier, where it is proven, and
  one line on why it works
- Cross-domain is the default framing, not a special case: *"proven in 4 domains · unused in
  yours"*
- On-demand scrape lives inside the Bench as an explicit action, not on the arrival surface
