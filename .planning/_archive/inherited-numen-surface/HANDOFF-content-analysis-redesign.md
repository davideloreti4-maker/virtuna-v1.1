# HANDOFF — Content Analysis frame redesign ("Craft" frame)

**Branch:** `feat/actions-frame-inline-redesign`
**Date:** 2026-05-30
**Status:** Audit done · identity reframe decided · 6 HTML sketches built · **visual direction NOT yet approved.** User says the refined versions still "don't feel like something Apple / Linear / Raycast would release." Blocked on a taste target + a concept decision (see §7).

> ⚠️ **Parallel session active on this branch.** Another Claude session auto-commits + auto-pushes here. HEAD moves between sessions — `git log` before assuming state. This redesign work is **sketches only, nothing committed to source yet** (mockups live in `.playwright-mcp/`, gitignored).

---

## 1. THE GOAL

Rework the board's **Content Analysis** frame from the ground up. Deliver the best user value from the engine's output data, in a refined design matching the Raycast / Anthropic / Linear / Apple / Stripe / Loom language. This is one frame in a board-wide redesign (Audience "Retention Story" is the sibling effort — see `.planning/HANDOFF-audience-redesign-v2.md`).

Current frame (what we're replacing): two columns — `HookDecompNode` (4 coral score bars + coherence/cognitive-load chips + weakest line + click-to-expand fixes) and `EmotionArcNode` (recharts area chart + peak/valley dots). Screenshot critique in §3.

---

## 2. THE KEY FINDING — it's an identity problem, not a styling problem

Mapped where every engine signal already renders on the board:

| Signal | Already owned by |
|---|---|
| Engagement percentiles (completion/comment/share/save) | **Input** (`InputResultCard.tsx`) |
| Overall score + "why" reasoning | **Verdict** (`verdict/assembleReasoningBuckets.ts`, `VerdictNode.tsx`) |
| Retention curve, personas, drop-offs | **Audience** (`audience/` → being redesigned to "Retention Story") |
| `factors[5]` scorecard (Visual hook/Audio/Pacing/CTA) + rationale + tips | **Actions** (`actions/ActionsFixesSlot.tsx` `Scorecard`) |
| Counterfactual fix list (timestamped) | **Actions** (primary), Verdict, Audience |
| Reshoot script, optimal post time | **Actions** |

→ The current frame shows **leftover hook scraps duplicated elsewhere**. It has no defensible territory. **Decision: reframe it as the "Craft" frame** — *"how well is this video made?"* — the production dimensions a creator controls, which **no other frame touches**:

- Input = *will it perform?* · Audience = *who watches / where they leave?* · Verdict = *the score & why* · Actions = *what to do next* · **Content Analysis = how well is it crafted? (Hook · Pacing · Audio · CTA)**

**Altitude split (avoids duplicating Actions):** Actions = *prescriptive* ("Pacing 6 → cut 2s at 0:18"). Content Analysis = *diagnostic evidence* ("why is pacing a 6 — energy dips 0:08–0:21, soft transitions, 38% silence"). It shows the granular signals behind the scores; **it does NOT show fix lists** (→ those point to Actions). Likely rename frame label to **"Content craft"** / "Craft".

---

## 3. AUDIT OF THE CURRENT FRAME (why it's weak)

- **Empty emotion arc eats 50% of the frame** — right column hardwired `flex-1`; when `emotion_arc` is null the user gets a bordered "isn't available" apology box. Worst default.
- **Bars lie** — all coral, all near-full; 7.0 and 9.0 look identical. The one useful signal (the weak link) is a faint `bg-accent/8` row tint that reads like hover.
- **Actionable takeaway buried** — `Weakest: …` is last, 11px, `white/65`.
- **Primary value hidden** — the "How to fix" expander has no affordance; undiscoverable.
- **Naked numbers, no good/bad frame** — "Coherence 9.0/10", "Cognitive load: Low" (inverted polarity — low is GOOD, user can't tell).
- **Scope mismatch** — titled "Content Analysis" but ~90% is the hook (first 3s); pacing/audio/CTA absent.
- **Massive unused data** (see §4).

---

## 4. DATA MODEL — what the engine produces (the texture that's OURS to surface)

Schemas: `src/lib/engine/qwen/schemas.ts` · `src/lib/engine/types.ts`

**Currently shown:** `hook_decomposition` (4 modality scores + weakest_modality + visual_audio_coherence + cognitive_load[INVERTED] + watermark_detected), `emotion_arc[]`.

**UNUSED + owned by nobody — the Craft frame's real material:**
- `video_signals` → `visual_production_quality`, **`pacing_score`**, `transition_quality` (0–10)
- `audio_signals` → `voice_clarity_0_10`, `audio_hook_first_2s_0_10`, **`silence_ratio` / `voiceover_ratio` / `music_ratio`** (0–1, a *mix profile* — describe, don't score), `audio_description` (10–280c). **Nullable** for slideshow/b_roll.
- `audio_perceptual_score` (0–100)
- `cta_segment` → `cta_present`, `strength` (0–10, null when absent), `type` (follow/comment/link_in_bio/…), `rationale`
- `hook_visual_impact` (0–10), `watermark_detected` {tiktok/ig/yt}
- `overall_impression` / `content_summary` (≤500c) — **pre-written human sentences** → source for the editorial verdict line
- `segments[]` → `t_start/t_end`, `visual_event`, `audio_event`, `is_hook_zone`, **`keyframe_uri`** (real video frames!) — only in aria today

**Polarity traps:** `cognitive_load` higher = WORSE (bucket 0–3 Low/good, 4–6 Med, 7–10 High/bad — surface as "Easy to follow", never raw). Audio ratios = mix profile, context-dependent (high silence bad on talking-head, fine on b-roll).

**Streaming contract:** `src/lib/engine/panel-mapping.ts` — `PANEL_IDS` includes `hook_decomp` + `emotion_arc`, both ready after `wave_1`. Phases: `analyzing → reconnecting → polling → done` (`use-analysis-stream.ts`). **Any new pillar (pacing/audio/cta) needs a `STAGE_TO_PANEL` mapping or it renders empty-forever during a live run.**

---

## 5. DESIGN PRINCIPLES (locked from the audit + the Audience grammar)

1. **Narrative spine** — one editorial verdict line (Anthropic voice) from `overall_impression`. Highest-risk build element: if the sentence is generic, the whole design loses its head. Needs a real generation strategy.
2. **Word-verdict / benchmark, not naked numbers** — but execute as *refined numerals*, not big cartoon words.
3. **Color is a scalpel** — monochrome base, coral on **exactly one** thing (the weak link), echoed once on the arc. No green/amber sprinkle, no decorative coral.
4. **Inline, no popovers/sheets** (matches Audience kill-popover decision).
5. **Semantic, honest encoding** — fix the bars-that-lie; the weak link must be visually obvious in <3s.
6. **Identical desktop frame + mobile card.**
7. **Meta-principle:** this frame grades *cognitive load* — it must itself be low cognitive load. Success metric = "what's my weakest craft element + why" answered in <3s.

**Board facts:** Content Analysis bounds = `x:0 y:832 w:832 h:240` (wide-short footer, 3.5:1), auto-grows to content (`board-constants.ts:41`). Tokens (CLAUDE.md): bg `#07080a`, frame `#18191a`, coral `#FF7F50`, 6% borders / 10% hover, 12px frame radius, Inter, inset top highlight `rgba(255,255,255,0.05) 0 1px 0 0 inset`.

---

## 6. SKETCHES BUILT (all in `.playwright-mcp/`, gitignored)

Serve: `cd /Users/davideloreti/virtuna-v1.1/.playwright-mcp && python3 -m http.server 8099`

| File | What | Verdict |
|---|---|---|
| `content-analysis-mockup.html` | **A/B/C/D** on one page (4 directions) | A=weakest-first list · B=balanced grid · C=timeline-fused · D=composite |
| `content-analysis-sketch-D.html` | standalone D (composite) | superseded |
| `content-analysis-refined.html` | **v1 refined** — killed all slop tells (cards/dots/chips/glyphs); mono numbers, hairlines, 1 accent | better, but "clean not crafted" |
| `content-analysis-refined-v2.html` | **v2 refined (current best)** — material (top catch-light + gradient + lift), Inter tabular numerals, no bars, even columns (CTA), arc with 1 coral focal dip-dot | **still rejected — see §7** |

Sketch evolution: A/B/C (3 directions) → critiqued → D (composite: stable Hook·Pacing·Audio·CTA grid + weak-link dominant in place + neutral-gray arc, coral only on dip + amber "watch" state + cognitive_load surfaced) → user called all of it "AI slop" → refined v1 (strip everything, monochrome, mono numbers, hairlines) → refined v2 (add real material + Inter tabular + remove vestigial bars).

Sample data used across all sketches: Hook Strong 8.0 · Pacing Drags 6.0 (dips 0:08–0:21) · Audio Crisp 8.2 (voiceover-led) · **CTA None (weak link, coral)** · energy arc peak 0:05 / dip 0:21 / 0:34 total.

---

## 7. THE BLOCKER — v2 still isn't Apple/Linear/Raycast tier

User feedback (verbatim): *"I don't know exactly what but still doesn't feel like something Apple Linear or Raycast would release."* Can't articulate it → **taste gap, not a polish gap.**

**My diagnosis of the deeper gap (the working hypothesis for the next attempt):**
1. **It's a *card*, not a *product surface*.** These companies ship dense purposeful *instruments*, not tasteful summary cards floating in a void. v2 looks like a component-library demo.
2. **Minimal-dark-card is now its own template.** Over-corrected from busy-slop into *tasteful-but-thin*. 4 numbers + a gentle squiggle says so little it reads **unfinished**, not refined. Apple's "quiet" is dense-with-meaning (Screen Time / Stocks / Fitness), not empty.
3. **The arc is decorative** — abstract energy curve a creator can't act on. No signature idea.
4. **It's abstract when it could be concrete.** Leading hypothesis ↓.

**LEADING NEW DIRECTION (not yet validated):** Make the **actual video the hero.** Use the real filmstrip **`keyframe_uri`** frames laid along the time axis; annotate craft *on the frame where it happens* — hook frame glows at the open, the energy-death frame at 0:21 is flagged, the dark gap at the end = missing CTA. Show the video, not abstract scores about it. This is what Loom/a real video tool would do, it uses real pipeline data, and it's concrete + signature.
- ⚠️ **Coordination risk:** the Audience frame ALSO fuses filmstrip-under-curve (its zone ②, per audience handoff). Must differentiate: Audience = retention/personas on the strip; Content Craft = production/craft annotations on the strip. Resolve overlap before building, or pick a different hero.

**TWO THINGS NEEDED FROM USER TO UNBLOCK (asked, awaiting answer):**
1. **One reference screenshot** — a Linear / Raycast / Stripe / Loom screen with the *feeling* they want. Taste target calibrates better than 1000 words; without it I'm averaging priors → "generic premium."
2. **Concept confirmation** — is "video/keyframes as hero, craft annotated on the timeline" the right direction, or something else (denser instrument? expert editorial note? interactive?).

---

## 8. STILL-OPEN DESIGN DECISIONS (independent of the taste blocker)

- **Verdict-line generation** — how to reliably synthesize the editorial headline from `overall_impression` + pillar scores (highest build risk).
- **Weak-link selection** — must be score-normalized (not naive `min()`); CTA-absent isn't always the weak link (content-type dependent); cognitive_load (if high) competes for the coral.
- **Color states** — 3-state (green/neutral/coral) vs 4-state with amber "watch". v2 went monochrome+coral-only; revisit if more nuance needed.
- **Degraded states** — text-only (no `video_signals` → no Pacing), slideshow/b-roll (`audio_signals` null → "No speech"), CTA present (real strength score, not "None"), `emotion_arc` absent (collapse arc, never apology box).
- **Mobile** (`MobileFrameCard`, camera `{0,0,1}`) — 4-col spec → vertical stack; arc full-width; drop tertiary captions.
- **Streaming reveal** — per-pillar skeleton → value as stages land; verdict writes last.

---

## 9. COMPONENT INVENTORY (files to touch for the build)

Dir `src/components/board/content-analysis/`:
| File | Now | Action |
|---|---|---|
| `ContentAnalysisFrame.tsx` | 2-col container (HookDecomp + EmotionArc) | recompose to Craft layout |
| `HookDecompNode.tsx` | 4 bars + chips + expander fixes | gut; fixes → Actions; hook becomes 1 pillar |
| `EmotionArcNode.tsx` | recharts area + dots | replace with refined arc / filmstrip-spine |
| `content-analysis-constants.ts` | labels, cognitiveLoadBucket, hookZoneLabel, COPY | extend for pacing/audio/cta verdicts + thresholds |
| `content-analysis-types.ts` | HookModality, FrameProps | extend for 4 pillars |
| `__tests__/*` | existing tests | rewrite |

Board wiring: `Board.tsx:478` · `BoardMobile.tsx:100-101` · `board-constants.ts:41` (bounds) · `GroupFrameOverlay.tsx:26,46` (label) · `CameraOverlay.tsx:14` (preset "3"). **Do NOT touch** `actions/`, `verdict/`, `audience/`, `InputResultCard.tsx` (ownership boundaries).

New pillars need data plumbing: `ContentAnalysisFrame` currently reads `result.hook_decomposition`, `result.heatmap.segments`, `result.emotion_arc`, `result.counterfactuals.suggestions`. Add `result.video_signals`, `result.audio_signals`, `result.cta_segment`, `result.audio_perceptual_score`, filmstrip `keyframe_uri`s. + `STAGE_TO_PANEL` entries for new panels in `panel-mapping.ts`.

---

## 10. RESUME CHECKLIST

- Dev server: `npm run dev` → http://localhost:3000 (Next 15 + turbopack).
- Mock server: `cd .playwright-mcp && python3 -m http.server 8099` → http://localhost:8099/content-analysis-refined-v2.html (current best).
- Test board permalink with real data: `/analyze/z05dIjbz4v4W`. Card mode: `localStorage.setItem('virtuna-board-view-mode','cards')`.
- Checks: `npx tsc --noEmit` · `npx eslint <files>` · `npx vitest run src/components/board/content-analysis`.
- Playwright MCP browser lock is flaky — if "Browser is already in use", run `rm -f ~/Library/Caches/ms-playwright/mcp-chrome-*/Singleton* && pkill -f mcp-chrome-` then renavigate.

## 11. IMMEDIATE NEXT STEPS (fresh session)

1. **Get the user's reference screenshot + concept confirmation** (§7) before drawing again — do NOT produce another card variant blind.
2. Once direction is set: build the chosen hero (likely filmstrip-spine) as a **standalone refined HTML sketch first**, screenshot, iterate to approval. Resolve the Audience-filmstrip overlap (§7).
3. Then design mobile + streaming + degraded states (§8) in the approved language.
4. Only then → real components (§9), screenshot each step, run tests. Add `STAGE_TO_PANEL` mappings. Keep fixes pointing to Actions (no duplication).
5. Verdict-line generation strategy (§8) before wiring real data.
