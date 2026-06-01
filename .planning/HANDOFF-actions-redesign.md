# HANDOFF — Actions Frame UI/UX Redesign

**Branch:** `feat/actions-frame-inline-redesign`
**Date:** 2026-05-30
**Status:** ✅ BUILT & verified (2026-05-30 session 2). Direction changed from G·Editorial (score-led) → **H·Action-led** — see §0.5. Awaiting user review in the live board. Not committed.

---

## 0.5 ✅ BUILT — Action-led (supersedes G·Editorial)

**Why the pivot:** the board's **Score frame** (`verdict` node, labeled "Score") sits *directly above* Actions in the same column (`x:864` — Score `y:0`, Actions `y:312`) and already owns the big number, verdict word, "Driving it/Watch out", the full factor breakdown (`WhyVerdictCollapsible`) and vs-history. G·Editorial's big `8.2/10` hero **duplicated all of that** one frame down — the cross-frame repeat is itself the "template" tell. User confirmed action-led. So Actions now owns ONLY "what to do."

**The design (3 band-driven states), verified in real components via throwaway `/actions-preview` route (now deleted):**
- **needs-work** (band low/mid, or AV): kicker `Fix first · N to go` (red dot, count only on crit) → hero = top fix (headline + 1-line detail) + `Copy rewrite ↗` coral text-link → quiet expandable secondary fix rows (headline + timestamp + caret) → best-time footer.
- **strong** (band high, not AV): inverts — `Post it` → **when-to-post is the hero** (big day+time + curated warm line + muted `Edit time`), fixes demote to `Optional polish` rows. No urgent accent.
- **degraded** (counterfactuals null): calm `Where to focus` advice rows + best-time footer with `· best guess` on fallback. Never an error.

**Dead data wired:** `counterfactuals.band` → drives which state/hero renders. `hook_decomposition.weakest_modality` → selects WHICH fix leads the hero (mirrors server `deriveOpeningLine`; never shown as debug text). `cta_segment` → NOT wired (lives only on Gemini sub-schema, not the aggregated result — needs a pipeline change; deferred).

**Files (new):** `actions-derive.ts` (pure view-model: `deriveActionsView` + `pickHeroFix`), `ActionsContent.tsx` (composition: Kicker/HeroFix/FixRow/Rows/Skeleton), `ActionsBestTime.tsx` (foot+hero variants, reuses `convertUTCWindow` + `OptimalPostEditPanel` + override). **Rewritten:** `ActionsNode.tsx` (thin data layer), `actions-constants.ts` (+`ACTIONS_COPY`, +3 telemetry events), `__tests__/ActionsNode.test.tsx` (8 action-led tests). **Frame chrome** (header "Actions" + caret + `p-4` body) is rendered by `GroupFrameOverlay` — ActionsNode renders body only.

**Gates:** tsc 0 errors · 42/42 actions tests pass · eslint clean. Verified visually in real components (both desktop + mobile use the same `ActionsNode`).

**Cleanup TODO (orphaned, 0 live importers — safe to delete after review):** `ActionsReshootHeroSlot.tsx`, `ActionsFixesSlot.tsx`, `ActionsOptimalPostSlot.tsx`, and their now-unused script render deps (`script/ScriptBody.tsx`, `ScriptEmptyState.tsx`, `CopyButton.tsx` — but KEEP `script/use-script.ts`, still used for the `Copy rewrite` opening line), `PlaceholderCard.tsx`. `OptimalPostCard.tsx` is also orphaned (logic moved to `ActionsBestTime`).

**Follow-ups:** (1) optional quiet "Full reshoot script" disclosure reusing `ScriptBody` (preserve the artifact behind progressive disclosure); (2) wire `cta_segment` as a synthetic CTA fix once it's on the aggregated result; (3) delete orphaned files above.

**⚠️ Working-tree note:** `InputResultCard.tsx` + `BoardMobile`/`InputNode` carry unrelated in-flight edits (Score-frame redesign, parallel). Do NOT stage them with the Actions commit.

---

### (original exploration notes below — kept for the lessons in §5)

---

## 0. Goal

Rework the board's **Actions** frame from the ground up. Deliver max user value from the engine pipeline output with a refined surface matching **Apple / Linear / Raycast / Stripe / Anthropic** design language. This is the first of a full board-frame redesign series.

User bar is HIGH and explicit: "something companies like Apple, Linear, Raycast, Revolut, Stripe, Loom, Anthropic would release." Repeatedly rejected work that felt like "AI slop / dashboard template." **Read §5 (why early passes failed) before designing — it's the whole lesson.**

---

## 1. The current Actions frame (what we're replacing)

Renders a tall vertical stack of 3 bordered boxes in `ActionsNode.tsx`:
1. **Reshoot script** (hero, top) — NEW OPENING / SCENE ORDER / VOICEOVER / CAPTIONS + "Copy all"
2. **What to fix** + **Score breakdown** (one box) — severity-tagged fixes + 5 factor bars
3. **When to post** — time pill + Edit + source pill

### Files (all real, audited)
- `src/components/board/actions/ActionsNode.tsx` — orchestrator (hooks: `usePermalinkAnalysis`, `useAnalysisStream`); derives `postWindow`, `counterfactuals`, `factors`, `advice`, `analysisId`; `ready` gates on data presence not stream phase
- `ActionsReshootHeroSlot.tsx` + `script/ScriptBody.tsx` `ScriptEmptyState.tsx` `CopyButton.tsx` `use-script.ts` `script-types.ts` `script-constants.ts`
- `ActionsFixesSlot.tsx` — fixes + factor `Scorecard` (both in ONE box)
- `ActionsOptimalPostSlot.tsx` + `optimal-post/OptimalPostCard.tsx` `OptimalPostEditPanel.tsx` `OptimalPostSourcePill.tsx`
- `PlaceholderCard.tsx`, `actions-types.ts`, `actions-constants.ts`
- **Mounted:** `Board.tsx:39` (import), `Board.tsx:477` (`layout.id === 'actions'`); mobile variant `BoardMobile.tsx`

---

## 2. Engine data contract (what we can show)

All on `analysis_results` row (JSONB), streamed/hydrated into `ActionsNode`.

| Field | Type / shape | Source | Status in UI |
|---|---|---|---|
| `factors` | `Factor[]` `{id,name,score 0-10,max_score,rationale,improvement_tip}` — `types.ts:183` | Qwen/Gemini | ✅ shown (scorecard) |
| 5 factor names | Scroll-Stop Power · Completion Pull · Rewatch Potential · Share Trigger · Emotional Charge | hardcoded | ✅ |
| `counterfactuals` | `{band:"low"\|"mid"\|"high", suggestions:[]}` — `types.ts:429` | Qwen stage 11 | suggestions ✅ / **`band` DEAD** |
| `CounterfactualSuggestionItem` | `{type:"fix"\|"stretch"\|"reinforcement", headline ≤80, detail, timestamp_ms, signal_anchor}` — `types.ts:413` | | ✅ (top 3) |
| `suggestions` | `Suggestion[] {id,text,priority,category}` — `types.ts:192` | engine | ✅ fallback when counterfactuals null |
| `optimal_post_window` | `{day_of_week, hour_range:[n,n], timezone:"UTC", reasoning, source:"niche"\|"creator"\|"fallback"}` — `optimal-post.ts:18` | DB lookup | ✅ |
| `optimal_post_override` | user edit | | ✅ |
| `script_result` (`ScriptResultBody`) | `{opening_line, scene_order[], voiceover, captions[]}` — `script-types.ts` | derived (see below) | ✅ |
| `overall_score` | **0-100** — `types.ts:219` | aggregator | ❌ not in Actions |
| `confidence_label` | HIGH/MEDIUM/LOW — `types.ts:221` | | ❌ |
| `hook_decomposition` | `{visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score, weakest_modality(enum), visual_audio_coherence, cognitive_load(INVERTED), watermark_detected}` — `gemini/schemas.ts:143`, `qwen/schemas.ts:167` | | ⚠️ rendered in **Content Analysis frame** (`ContentAnalysisFrame.tsx:28`), NOT Actions |
| `behavioral_predictions` | completion/share/comment/save/loop _pct + percentile — `types.ts:~592` | DeepSeek | ⚠️ rendered in **Audience frame**, not Actions |
| `cta_segment` (`CtaSegmentResult`) | `{cta_present, strength, type, rationale}` — `gemini/schemas.ts:129` | | ❌ **DEAD in product** (zero component usage) |

**Critical insight — the script is derived from the fixes+factors.** `src/app/api/analyze/[id]/script/route.ts`: `deriveOpeningLine()` filters hook-anchored counterfactuals; `deriveVoiceover()` uses worst-factor `improvement_tip`. → **script, fixes, and scorecard tips are 3 renderings of ONE truth.** This redundancy is the deepest design problem.

**Dead/orphaned data worth wiring:** `counterfactuals.band` (drives framing), `cta_segment` (a whole fix category), `weakest_modality` (most actionable signal — currently in the wrong frame).

---

## 3. The audit (why the current frame is weak)

Severity-ranked, code-grounded:

- 🔴 **A1** Scorecard bar is hardcoded coral for every factor regardless of score (`ActionsFixesSlot.tsx:203` `backgroundColor:'#FF7F50'`). Color encodes nothing; 9/10 and 4/10 look identical. **The #1 fix.**
- 🔴 **A2** Fixes + factor-tips + script = same insight 3× in 3 visual languages (proven by `route.ts` derivation). Feels thorough, is redundant.
- 🔴 **A3** `counterfactuals.band` computed "for adaptive rendering" (`types.ts:423`) but ignored — every video gets flat treatment.
- 🟠 **A4** Stated "highest value first: reshoot script" (`ActionsNode.tsx:72`) is inverted — heaviest artifact leads before user knows what's wrong. Correct: diagnose → act → ship.
- 🟠 **A5** Two badge systems (`type` fix/stretch/reinforcement vs `priority` high/med/low) render near-identically and never co-occur.
- 🟠 **A6** `weakest_modality` (the single most actionable signal) lives in Content frame, separated from the fix that acts on it.
- 🟠 **A7** Strong factors (9/10) still ship "improvement tips" — noise.
- 🟡 8-step white-opacity ramp (muddy hierarchy) · dashed borders used as structure · GlassPill used as decorative inline chrome · "When to post" fallback reads as an error.

---

## 4. Design laws (the spec the redesign obeys)

1. **Color is semantic; default is monochrome.** Text = 4 tiers only (`white/95, /55, /32, /28`). Score color: on 0-10 → `<5 red / 5-7.4 amber / ≥7.5 green` (on 0-100 → `<50 / 50-74 / ≥75`). Coral (`#FF7F50`) = brand accent, **one** spot.
2. **Type + space, not boxes/widgets.** Hairlines and whitespace for structure. No nested bordered boxes.
3. **One focal element** per frame; the rest recedes.
4. **Band drives framing** (verdict + count): low = "fix these," high = "you're solid."
5. **Collapse the redundant chain** — a fix carries its evidence (weak factor + weakest_modality) and its scripted remedy as ONE progressively-disclosed object.
6. **Earn confidence, don't apologize** — fallback window = "best guess," not "unavailable."
7. **Motion functional only.** **Wire dead data** (`band`, `weakest_modality`, `cta_segment`).

Tuned palette landed on in final sketch: `--green:#62cda1 --red:#ef6360 --amber:#eaa94a --coral:#FF7F50`, surfaces `--bg:#08090b --card:#0d0e11 --line:rgba(255,255,255,0.065)`.

---

## 5. ⚠️ WHY EARLY PASSES FAILED — read this before designing

The user rejected three rounds. The lesson progression:

1. **First rejection ("AI slop"):** the problem was **craft, not IA**. Tells: emoji-as-icons (`⧉ ⌄ ▸`), uppercase micro-label disease (`WHAT TO DO`, `HIGH`), engine debug-data shown as UI (`↑ moves Scroll-Stop · weakest modality audio`), a border around everything, no hero/scale-contrast, muddy even spacing. → Fixed with real **Phosphor icons** (`@phosphor-icons/web`), a hero moment, human copy, air.
2. **Second rejection ("not Apple/Linear"):** glowing coral button (use restrained **tinted-accent** button, no glow/bevel), two loud hues fighting (one disciplined accent), copy too long (one line), leftover debug words (`caption`).
3. **Third rejection ("still doesn't feel like it"):** **THE KEY LESSON — it was the CONCEPT.** Everything I built was a **dashboard widget**: gauge/score ring, segmented mini-bars, icon-prefixed list rows, ~12 elements at once. That vocabulary IS the "SaaS template" tell. Apple/Linear/Raycast ship **brutally reduced** or **editorial/typographic** surfaces — NO gauges, NO decorative segments, functional icons only, big confident type, lots of air.

**Do not reintroduce: progress/gauge rings, segmented score bars, leading icons on every row, uppercase labels, emoji glyphs, glowing buttons, or "show everything at once."**

---

## 6. Current best direction → **G · Editorial** (closest to the bar)

File: `.planning/sketches/actions-editorial.html` (Strong + low-band states side by side).

The concept that finally read as premium:
- **Score is the moment** — large number (~54px Inter, `tabular-nums`, `-.04em`), **color-coded by band** (green 8.2 / red 4.1). This gives the emotional hit a gauge faked, with zero template feel. `/ 10` small in `t3`.
- **No gauge, no segmented bars, no icon-prefixed rows.**
- Verdict = a headline (`Strong.` / `Hold off.`); action = a **quiet coral text-link** (`Copy rewrite ↗`), not a button slab.
- Footer = pure text rows (`Breakdown · all five →`, `Best time · Tue, 7–10 PM`), no icons/widgets.
- Type + space carry everything; one accent; lots of air.

**Awaiting user confirmation** that G is the direction (last message asked). Assume yes unless they say otherwise; remaining work is refinement-level.

---

## 7. The sketch files (all in `.planning/sketches/`)

| File | Contains |
|---|---|
| `actions-redesign.html` | A·Triage, B·Scorecard-native, C·Briefing, **+ D·Synthesis** (4-up compare) |
| `actions-hybrid.html` | D·Synthesis solo (high + low band), larger |
| `actions-refined.html` | E·Refined (Phosphor icons + score ring — superseded) |
| `actions-production.html` | F·Production (tinted button + gradient ring — superseded) |
| `actions-editorial.html` | **G·Editorial — current best** |
| `*.png` | rendered screenshots alongside each |

**Render:** headless Chrome (network on for Inter/Geist-Mono/Phosphor):
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --force-device-scale-factor=2 \
  --virtual-time-budget=2800 --window-size=980,720 \
  --screenshot="$PWD/out.png" "file://$PWD/actions-editorial.html"
```
**Preview server:** `cd .planning/sketches && python3 -m http.server 4321` → `http://localhost:4321/actions-editorial.html` (kill: `lsof -ti:4321 | xargs kill`).

Sketches use Phosphor via `<script src="https://unpkg.com/@phosphor-icons/web@2.1.1">`; real app uses `@phosphor-icons/react`. Watch CSS class collisions (a global `.r{background:red}` once painted an action row — scope color utility classes).

---

## 8. Open decisions (lock these first, then build)

1. **Confirm G · Editorial** as the concept (or push type/spacing further).
2. **Hero number source** — sketches show `8.2 / 10`, but engine has `overall_score` **0-100** and `factors` 0-10. DECIDE: show `overall_score` as `/100`, or a `/10` (and if /10, derived how?). This is a real data decision, not cosmetic.
3. **`Copy rewrite`** — stays a coral text-link, or a whisper-quiet tinted button?
4. **Verdict copy** — templated (band-keyed strings: `Strong.`/`Hold off.`) or LLM-generated per video? Templated = safe+instant; LLM = warmer but quality-risk.
5. **Score thresholds** on 0-10: confirm `<5 red / 5-7.4 amber / ≥7.5 green`.
6. **Breakdown destination** — expand in-frame, or link to the Content Analysis frame (which already renders `hook_decomposition`)? Avoid re-duplicating.
7. **Expand/collapse + state persistence** — per analysis or reset each visit?

---

## 9. Next steps (build path)

1. Get user confirmation on G + answers to §8.
2. Write the **build-ready spec**: map G onto `ActionsNode` / `ActionsFixesSlot` / scorecard / optimal-post — exact token changes, data-binding, which sub-components collapse or die.
3. **Wire dead data:** `band` → verdict + count; `weakest_modality` → onto the fix; `cta_segment` → a fix when `!cta_present || strength<5`.
4. **Collapse the A2 redundancy:** fix = one object owning its evidence + scripted remedy; the full 4-part script becomes assembled-from-fixes / behind disclosure, not a stacked hero.
5. Implement with real `@phosphor-icons/react`, Raycast tokens (BRAND-BIBLE.md), Tailwind v4. Respect known issues (oklch dark colors, backdrop-filter via inline style — see CLAUDE.md).
6. **Verify in the real board** (Playwright/screenshot), both high-band and low-band/degraded (counterfactuals null, factors missing, fallback window).

---

## 10. Context pointers
- Project: Next.js 15 · TS · Tailwind v4 · Supabase · coral/Raycast aesthetic · `BRAND-BIBLE.md` + root `CLAUDE.md` (Raycast design rules: 6% borders, 12px card radius, Inter, GlassPanel pattern).
- Pipeline = Qwen-only (no Gemini/DeepSeek despite legacy file/type names — see memory `qwen-only-pipeline`).
- Related active effort: board UX overhaul (memory `board-ux-overhaul`, `.planning/HANDOFF-audience-redesign.md` for the Audience frame).
- This was started via `/gsd-quick` but never created a `.planning/quick/` task — it stayed an exploratory design session. No commits made; only sketch files + this handoff are new/untracked.
