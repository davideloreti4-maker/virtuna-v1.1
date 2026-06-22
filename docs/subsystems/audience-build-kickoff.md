> ⚠️ **SUPERSEDED 2026-06-24 — steps 1→5 are BUILT + live-UAT'd.** Use
> **`docs/subsystems/audience-signature-handoff.md`** for the next session. This file is kept
> for the original scope/verification notes only; its "start at step 1" instructions are stale.

# Audience Build — Fresh-Session Kickoff

> Hand-off for the BUILD of the real `AudienceSignature`. Design is complete, live-validated,
> verified against code (2026-06-24). This file = the only thing the fresh session must read
> first; everything else it pulls on demand from the anchors below.

---

## Paste this as the opening prompt

```
Read docs/subsystems/audience-build-kickoff.md, then docs/subsystems/audience.md §P
(esp. P.11 impl map + P.14 build spec). We're building the real AudienceSignature.
Scope THIS session = critical path P.11 steps 1→5 only (schema → scrape-collapse →
enrich-signature → calibration → reveal). Defer steps 7–9. Start with step 1.
Plan it, then build. ENGINE_VERSION must stay untouched; new signature gates behind
non-general audiences ONLY; keep the General-regression suite green.
```

---

## What this is

Make the audience **real** — derived from the account, not a static goal-intent lookup.
One Apify scrape + one Flash call → a frozen `AudienceSignature` JSONB on the `audiences`
row → read everywhere (STEER/REACT/REFINE), never re-derived on the hot path.

SSOT for the whole design: **`docs/subsystems/audience.md` §P** (P.0–P.14). Don't re-derive it.

## Scope THIS session — critical path only (P.11 steps 1→5)

1. **Schema + types** — `audiences` row + `audience-types.ts` + `audience-repo.ts`
2. **Scraping** — collapse 2 actors → 1; add free native subs
3. **Enrichment** — ⭐ new `enrich-signature.ts` (omni-flash watch ×3–5 + 1 text-flash synth)
4. **Calibration** — `calibration.ts`: personal/target → scrape → enrich (replaces `deriveAudienceProfile`)
5. **Reveal screen** — `calibration-flow.tsx` + new component (the "it's real" showcase)

**DEFER to a later session** (depend on the un-dissected §03 SIM path): 7 generation/SIM
wiring · 8 composer intent · 9 flywheel/drift. Reason: the signature's `reaction_frame`
feeds the SIM fold, and §03 backlog flags **S1 (script/remix niche-blind)** — map that first.

## Verified ground truth (checked against live code 2026-06-24)

- **F1 / A2 confirmed** — `calibration.ts:66` `deriveAudienceProfile(profile, _videos)`: videos
  arg literally unused (`_videos`); `temperature_mix`/`top_dispositions` come off the CONSTANT
  archetype distribution → identical for every audience. Only `follower_tier` is real. **This
  function is what step 3/4 replaces.**
- **F3 / A1 confirmed** — `hooks-runner.ts:322` + `ideas-runner.ts:295`: `resolveAudienceWeights(...)`
  then `void resolvedWeights;`. Numeric weights influence nothing live; Flash uses the repaint.
  → step 7 (deferred) makes weights real; this session just bakes them correctly.
- **Scrape collapse valid** — today 2 clockworks actors (`apify-provider.ts:24-25`
  `DISCOVER_PROFILE_ACTOR` + `DISCOVER_VIDEO_ACTOR`). P.12 live probe proved the single
  `tiktok-profile-scraper` returns videos + free subtitle links in ONE run.

## Schema is HALF-BUILT — step 1 is an ALTER, not a CREATE

`supabase/migrations/20260619000000_audiences.sql` already ships the `audiences` table:
`id, user_id, name, type, platform, goal_label, goal_intent`, the **4 weight cols**
(`fyp/niche/loyalist/cross_niche` NUMERIC(5,4), sum-check), `personas jsonb`, `profile jsonb`,
`calibration jsonb`, plus `threads.active_audience_id`.

Step 1 migration work:
- **ADD `creator_persona jsonb`** on `audiences` (PER-AUDIENCE per §P.8 — do NOT reuse the
  profile-level `creator_profiles.writing_voice_sample` from `20260619000100`).
- **RESTRUCTURE `profile jsonb` → richer `signature jsonb`** (engagement_profile, interest_tags,
  what_resonates/falls_flat, `personas[]` w/ `reaction_frame` + `evidence`). Keep the 4 weight cols.
- Regenerate `src/lib/database.types.ts` → drop the `(supabase as any)` casts (A6) in `audience-repo.ts`.
- IF-NOT-EXISTS / idempotent, matching the existing migration idiom.

## Two decisions to settle before/at coding (neither blocks step 1)

- **P-6** — can the actor transcribe a ≤5 SUBSET in one run, or needs a 2nd tiny scrape?
  Verify on first live run; **default to free native subs only, AI-transcribe NEVER** ($48/1k).
- **GAP-C2** — intent vocab mismatch: composer `grow|sell` (2) vs audience `goal_intent`
  `grow|sell|authority|nurture` (4). Only bites at step 8 (deferred) — note, decide later.

## Hard guardrails (the byte-stable Flash path)

- **`ENGINE_VERSION` untouched.** New signature activates ONLY for calibrated (non-general)
  audiences. General still resolves DEFAULT + niche-only SIM (D-17).
- **General-regression suite stays green by construction** (`resolveAudienceWeights([]) === DEFAULT`).
- **All enrichment LLM calls `temperature:0, seed:7`** (QWEN_SEED), system prompts byte-stable
  (cache prefix). Frozen output on the row → hot path never calls an LLM for the audience.
- **UI** = build on the LOCKED flat-warm system (`globals.css` + `docs/DESIGN-SYSTEM.md`). No
  token/aesthetic changes — new screens only.

## Key file anchors

| Concern | File |
|---|---|
| Design SSOT | `docs/subsystems/audience.md` §P (P.11 map, P.14 spec) |
| Backlog | `docs/DISSECTION-BACKLOG.md` (A1–A6, A-T) |
| Calibration (F1 site) | `src/lib/audience/calibration.ts:66` |
| Weights void (F3 site) | `src/lib/tools/runners/{hooks,ideas,chat,remix}-runner.ts` |
| Scrape (2→1 collapse) | `src/lib/scraping/apify-provider.ts:24` |
| Types / repo | `src/lib/audience/{audience-types,audience-repo}.ts` |
| Existing migration | `supabase/migrations/20260619000000_audiences.sql` |
| Reveal UI (step 5) | `src/components/audience/calibration-flow.tsx` |
| Persona UI (step 6, deferred) | `src/components/audience/{audience-profile-view,persona-edit-form}.tsx`, `src/components/audience-lens/*` |
| Composer intent (step 8, deferred) | `src/components/app/home/composer-controls.tsx`, `composer.tsx` |

## ⚠ Note on `.planning/` in this worktree

It is STALE (inherited Landing-v2 / v5.0 identity). Ignore `MILESTONE.md` / `STATE.md` /
`ROADMAP.md` here. The real milestone artifact is the dissection: `docs/ENGINE-ATLAS.md`,
`docs/DISSECTION-BACKLOG.md`, `docs/subsystems/`.
