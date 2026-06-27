# UI Surface: Skill output cards — refined design spec

> Lane: `lane/polish`. Component owner: the cards live in `src/components/thread/**` (GSI HOLD list),
> BUT the existing skill cards (hook/idea/script/remix/Read/account/etc.) are **NOT** what GSI rebuilds —
> GSI *adds* new Profile/Simulate/Predict card types. Owner call (2026-06-26): refining the existing
> cards is in-scope; GSI hasn't diverged `thread/**` (verified: 0-file diff `main..milestone/numen-gsi`).
> Land small + merge fast so GSI absorbs it before it writes new-card work. Date: 2026-06-26.
> Design SoT: `docs/DESIGN-SYSTEM.md` + `src/app/globals.css` `@theme`.
>
> **Throwaway sketches** (the design source for this spec) live in `.planning/sketches/`:
> `hook-card-refined.html`, `all-skill-cards-refined.html`, `data-rich-skills-refined.html`,
> `read-test-chat-refined.html`. They were served for review via temp copies at `public/_sketch-*.html`
> — **DELETE those `public/_sketch-*.html` before any PR** (throwaway; the canonical copies are in `.planning/sketches/`).

## 0. Skills in scope

`/explore` · `/ideas` · `/hooks` · `/script` · `/remix` · `/chat` · `/test`, plus **Account Read** and the
flagship **video Read** (`/analyze`). The thread block types they render (SSOT `src/lib/tools/blocks.ts`):
`hook-card`, `idea-card`, `script-card`, `remix-card`, `multi-audience-read` (in-thread Read),
`account-read`, `outlier-grid` (Discover/Explore), `band` + `personas` (test output), `persona-chat-turn`,
`markdown`. The video Read is a separate renderer system (`src/components/reading/**`), NOT a thread block.

## 1. The shared refined design language (applies to every card)

1. **Flat matte** — NO inline inset-shine `boxShadow`. Resting cards = border (`white/[0.06]`) + tone only.
   (The `@theme` shadow block explicitly removed white inset shine; the cards re-add it inline — remove it.)
2. **Warm-cream, never cold white** — dim text/labels/rank use the cream scale
   (`--color-foreground-muted` #8a857c), NOT raw `rgba(255,255,255,.3x)` (reads bluish/off-brand).
3. **Single proof unit** — band + fraction + reaction ribbon + lead quote in ONE bordered, hoverable
   block that IS the AudienceLens entry. State the fraction ONCE (kills the duplicated ribbon-label +
   band-row). Band color used ONCE (a dot + the word), never double-applied.
4. **Visible Lens entry** — the proof unit shows reactor avatars + an explicit **"See the room →"** cue.
   (Today the quote is a `LensTrigger` with zero visual affordance — the flagship interaction is invisible.)
5. **Eyebrow kicker** — archetype/context as a quiet uppercase kicker ABOVE the hero line (band-colored
   dot), so the hook/title reads first. Rank/meta to the right.
6. **Why-teaser on the face** — surface the first line of `mechanism`/`whyItFits`; full detail on expand.
7. **One primary action** — the **forward chain step** as a NEUTRAL CREAM button (`--color-action`,
   per design system primary≠accent); Save = icon. Chain map:
   `Ideas →(Develop into hooks)→ Hooks →(Write script)→ Script →(Test full script)→ reaction`; `Remix →(Develop into hooks)`.
   - `Test full script →` (Script card ONLY, the chain's terminal step) = re-run the **whole script**
     through the deeper **SIM-1 Max** test, vs the opener-only Flash read shown above it. "full script",
     NOT "full video" — the uploaded-video read is the separate `/analyze` Read. **Resolved 2026-06-27:
     the hook card carries NO Test-full** — a hook is only an opener, and its handoff sent the same lone
     line already Flash-read, so "full" referred to nothing. Hooks advance via `Write script →` instead.
8. **Zero legacy coral** — no `#FF7F50` / `rgba(255,127,80,…)` anywhere; accent stays terracotta
   `#d97757` at near-zero dosage (liveness only). Monochrome by default; band success/warning/error are
   sanctioned DATA tones (not brand accent).
9. **Vertical-first + platform-aware** — all video media is 9:16 (short-form); every scraped item shows
   its platform via a **monochrome** mark (TikTok note · Instagram camera, `currentColor` — no brand colors).

## 2. Per-card notes

- **Hook** — eyebrow archetype kicker + rank; hero hook; why-teaser; proof unit; expand = seed + delivery;
  primary `Write script →` + Save icon (NO `Test full →` — see §1.7; a hook is only an opener). **Remove
  the dead "If this could flop →" branch** — `predictedFailureMode` is always null (rubric-critic removed
  S5); it never renders.
- **Idea** — kicker "Made for your audience"; "your take" badge (amber = data status); whyItFits folded into
  the why-line; primary `Develop into hooks →`.
- **Script** — opener proof unit labelled "opener only" (honesty spine); beats = quiet bordered rows with
  retention reasoning inline (no per-beat color); primary `Test full script →` (the chain's terminal step —
  deep-tests the whole script on SIM-1 Max vs the opener-only read; "full script", not "full video").
- **Remix** — "Borrowed · {format}" + audience-steer tag as eyebrow; decode anatomy (4 beats) on expand;
  primary `Develop into hooks →`. Show the **real source video** (see §3).
- **The Read (in-thread `multi-audience-read`)** — ⚠️ currently paints a **legacy `#FF7F50` coral panel +
  ✦/◐/△ glyphs** (retired-system remnants) — STRIP both. Monochrome: band = dot+word; the **Lever** (the
  payoff) leads with a neutral cream left-rule + bold. Two-audience compare reads at a glance; verbatim
  "room" kept, tightened. NOTE: the in-thread Read is **STATIC (P9 boundary)** — no live Lens/cloud/chat;
  the "Open in AudienceLens →" action is aspirational (P9/GSI), keep Save for now.
- **Account Read** — profile header (avatar + name + ✓ + follower/like/post counts) + "Read from your last
  N posts" strip of 9:16 covers w/ view counts; two-col working/fix (success/warning data tones); format-mix
  cream bars; accuracy line. Add a forward action `Write to my strengths →` (currently dead-ends) — NEW behavior, needs wiring.
- **Discover/Explore (`outlier-grid`)** — profile-mode header + 9:16 vertical tiles (cover, multiplier
  badge, view count + duration overlay, caption, fit chip). Per-tile platform tag in **niche/mixed mode
  only** (profile mode → header tag covers it). Measured data only (no SIM band/quote — honesty).
- **Video Read (`/analyze`, `reading/**`)** — vertical 9:16 poster + retention-curve overlay + platform tag;
  arc gauge with the **engine 0–100 score** (the ONE place a numeric score is honest) + niche rank; 3 stats
  (watch-through · biggest drop · finish); score-driver bars (Hook/Retention/Shareability); Fix-first +
  hook rewrite; deeper-read accordion; pinned follow-up chat.
- **/chat** — asymmetric bubbles: user = chip flush-right; Numen = flush-left prose (no bubble). Persona
  chat ("Ask them why") reuses this with the persona tag in the speaker row.
- **/test** — concept → proof unit (band + 10-reactor room + "See the room →"); same language as above.

## 3. Data-richness — surface the real Apify scrape ("feel real value")

The profile/video skills should show the real scrape. Inventory (SSOT `src/lib/scraping/types.ts`):

**Available in the scrape TODAY, plumbed to ~zero cards:**
- Profile (`ProfileData`): `avatarUrl`, `displayName`, `bio`, `verified`, `followerCount`, `heartCount`
  (total likes), `videoCount`.
- Per-video (`VideoData`): `caption`, `views/likes/comments/shares/saves`, `hashtags[]`, `durationSeconds`,
  `postedAt`, `mediaUrl` (mp4), `subtitleUrl`.

**Available from Apify but DROPPED:** video **cover/thumbnail** — `shouldDownloadCovers:false` in
`apify-provider.ts` and `remapClockworksVideo` doesn't map clockworks' `videoMeta.coverUrl` (the URL is in
the item already — cheap to add; no extra scrape cost).

**The bottleneck = the block schemas.** `outlier-grid`, `account-read`, `remix-card` carry metrics ONLY —
no avatar, no cover, no profile stats, no video list. **The UI can only render what the block holds.**

## 4. Plumbing required (Tier C — backend, NOT lane/polish — hand to engine/GSI session)

1. Add `coverUrl?: string` to `VideoData`; map `videoMeta.coverUrl` in `remapClockworksVideo`
   (+ `remapApidojo..`). Optionally flip `shouldDownloadCovers` only if hotlinking the URL fails.
2. Add media/profile fields to the block schemas in `src/lib/tools/blocks.ts` (shared SSOT — GSI also
   touches it; coordinate): `outlier-grid` tile → `coverUrl`, `platform`; `account-read` → profile block
   (avatar/name/verified/counts) + analyzed-video list (cover + views); `remix-card` → source video
   (cover, author handle, avatar, metrics, platform).
3. Runners populate the new fields from the scrape.
4. **`platform` field** end-to-end (`VideoData`/`ProfileData`/blocks) — currently absent; the `platform`
   enum exists only in API/audience surfaces.

## 5. Platform / Instagram findings (the "TikTok vs Instagram" gap)

- **Scraping is TikTok-ONLY** (all clockworks/apidojo actors). Instagram analysis isn't wired, though the
  product model anticipates it (`PlatformType = "tiktok"|"instagram"`, DB `instagram_handle`, audience
  platform enum). IG support = a new actor + a `platform` field + classifier support.
- **🔴 Bug (today, design-independent):** `src/lib/discover/classify-input.ts` only matches `@handle` or
  `tiktok.com/@user`. An **`instagram.com/...` URL silently falls through to "niche" mode** → treated as a
  search phrase → broken `/explore` for IG. Fix the classifier to detect platform from the URL/handle.
- Platform indicator treatment = **monochrome** mark (no brand colors, per the LOCKED accent dosage).

## 6. Workstreams (for implementation in a fresh session)

- **Tier A+B (visual + structure) — lane-shippable now, needs no new data:** matte, warm-cream, single
  proof unit, eyebrow, why-teaser, action hierarchy, **remove dead flop branch**, **strip legacy coral from
  the Read**. Edits `thread/*.tsx` (+ the cards' shared template). GSI hasn't touched these; land small.
- **Tier C (data-richness + platform) — backend dependency:** §4 + §5 plumbing in `src/lib/**` (engine/GSI
  session), THEN the card UI consumes the new block fields. Ownership decision deferred (owner call).

## 7. Open decisions (carry into implementation)
- ~~Confirm hook primary = `Write script →` (vs `Test full →`).~~ **RESOLVED 2026-06-27:** hook primary =
  `Write script →`; `Test full →` removed from the hook entirely (a hook is only an opener → "full" was
  meaningless). Test-full survives only on the Script card, renamed `Test full script →` (§1.7).
- Account Read `Write to my strengths →` — net-new forward action; wire to seed Ideas? (product call)
- Tier C plumbing ownership: engine/GSI session vs lane/polish-with-coordination (deferred).
- Platform mark: final icon assets (the sketch uses simplified SVGs).
