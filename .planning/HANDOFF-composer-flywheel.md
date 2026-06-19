# HANDOFF — Composer (UX-01) + Flywheel pin (FLYWHEEL-02)

> **Purpose:** two self-contained tasks to finish in plain chat (no GSD) before continuing with Phase 11 (Explore).
> Branch: `milestone/numen-tools`. Worktree: `~/virtuna-numen-tools`. Stack: Next.js 15 · TS · Tailwind v4 · Supabase.
> Hard rules (always): flat-warm THEME-06 SSOT, fixed typed renderers (no model-gen UI), Qwen-only, engine regression-gated
> (keep suite green, `ENGINE_VERSION` 3.19.0 untouched unless deliberate video-scoring change). Run `npm test` + `npm run build` before committing. Commit format `type(scope): desc`, then it auto-pushes.

---

## TASK 1 — Composer / skill-selector (UX-01) · build the locked sketch

**Direction is LOCKED** (don't re-explore). Winner = sketch **006 Variant 1 "Minimal · context surfaced"**.
- Sketch (open in browser): `.planning/sketches/006-composer-skill-selector/index.html`
- Theme tokens used: `.planning/sketches/themes/flatwarm.css` (mirror of live `src/app/globals.css`)
- Full decisions: `REQUIREMENTS.md` → `UX-01`; memory `composer-ux01-locked`

### What to build (replace the chip row)
A composer bottom control row:
`[+]  [Skill pill ▾]  [audience icon]  [intent icon]  ······  [● SIM-1 Flash/Max]  [↑ send]`

- **Skill pill** = the ONE accented/bordered control. Opens a **popover** grouped **CREATOR / MARKETING**, each row = line-icon · name · one-line desc · **`/command`** · MAX badge (where the video model fires) · check on active.
- **Audience** + **Intent** = **icon-only borderless** buttons beside the skill (title/tooltip shows value); each opens its own small popover (audience list + "Manage audiences ›"; intent = Grow/Sell segmented).
- **`+`** = upload/attach popover → "Upload video (⌘U) — runs a full SIM-1 Max Test", "Add files/photos", "Take screenshot".
- **Model** = **READ-ONLY indicator** (no dropdown, no "auto" label). The skill decides it: Test + Ad Creative → **SIM-1 Max**; all others → **SIM-1 Flash**. Terracotta dot on Max.
- **`/` slash entry**: typing `/` in the textarea opens the skill list as a command menu, filterable; selecting sets the skill and clears the `/`.
- **Popover everywhere** (desktop AND mobile — NO bottom sheet). Composer sits LOW so the upward popover has room; popover needs **`max-height` + scroll** (9 skills overflow otherwise). Mobile media query (verified at 390px).
- Premium **line-icon SVGs — NO emoji**. Flat-warm: warm charcoal `#262624`/composer `#1e1d1b`, cream `#ece7de`, **terracotta** coral `#d97757` (matured — NOT bright `#FF7F50`), Newsreader serif greeting, hairline borders, no glass/glow.

### Skill ↔ `/command` ↔ model table (the SSOT to wire)
| Skill | `/` command | Group | SIM-1 model | tool id |
|-------|-------------|-------|-------------|---------|
| Explore | `/explore` | Creator | Flash | `explore` *(new)* |
| Ideas | `/ideas` | Creator | Flash | `idea` |
| Hooks | `/hooks` | Creator | Flash | `hooks` |
| Script | `/script` | Creator | Flash | `script` |
| Remix | `/remix` | Creator | Flash | `remix` |
| Test | `/test` | Creator | **Max** | `test` |
| Chat | `/chat` | Creator | Flash | `chat` |
| Offer Validation | `/offer` | Marketing | Flash | `offer` *(new)* |
| Ad Creative | `/ad` | Marketing | **Max** | `ad` *(new)* |

> `explore` / `offer` / `ad` are NEW ids — they ship as their phases land (11 / 16). For the composer build, render them as **"coming soon" disabled rows** (or behind a flag) so the selector is built once and skills light up per phase. Don't block the composer on those routes existing.

### Real files
- `src/components/app/home/tool-chips.tsx` — **the thing being replaced**. `ToolId` union (`"test"|"idea"|"hooks"|"chat"|"script"|"remix"`) is the current SSOT; extend with `explore`/`offer`/`ad`. `MODEL_LABEL` map already encodes Flash/Max here — reuse it as the read-only indicator source.
- `src/components/app/home/composer.tsx` (~45KB) — host; `activeTool` routing + `testBrief`/`handleTestHook` carry-in live here. Wire the new selector + `/` handler in.
- `src/components/app/home/audience-chip.tsx`, `platform-chip.tsx` — existing chip patterns to fold/replace.
- `src/lib/tools/tool-runner.ts` — runner id union; keep it the SSOT, mirror any id additions.

### Acceptance
- Looks like sketch 006 Variant 1 in the real app (flat-warm, line icons, terracotta stele).
- Skill popover grouped Creator/Marketing with `/command` labels + MAX badges; active skill checked.
- Audience + intent icon-only; model is a read-only indicator that flips Flash↔Max with the skill.
- `/` in the field opens + filters the skill menu and switches skill.
- Popover scrolls at 9 skills; works at desktop + 390px mobile; nothing clips.
- `npm test` green, `npm run build` compiles, `ENGINE_VERSION` untouched.

---

## TASK 2 — Wire the predicted-signature pin (FLYWHEEL-02) · the flywheel is currently DORMANT

**The bug:** `pinPredictedSignature()` is built, exported, unit-tested — **but no SIM runner calls it**, so the predicted vector is never written, so the paste-a-URL → reconcile → recalibrate loop (the moat) can't fire end-to-end.

- Function: `src/lib/tools/runners/flash-runner.ts:144`
  `pinPredictedSignature(supabase, personas: FlashPersona[], ctx: { audienceId: string|null, analysisId?: string|null }): Promise<boolean>`
  — computes `predictedSignature(personas)` ONCE, persists via `insertOutcomeSignature` (`source:"paste_url"`), **non-fatal** (never throws, returns false on failure).
- Test that already passes (the contract): `src/lib/flywheel/__tests__/predicted-pin.test.ts`

### What to do
Call `pinPredictedSignature(...)` at the **post-SIM point** in each runner that produces a predicted signature — i.e. right after the Flash SIM resolves its `personas`, before/alongside card render. Runners:
`src/lib/tools/runners/` → `ideas-runner.ts`, `hooks-runner.ts`, `script-runner.ts`, `remix-runner.ts` (text path). Pass the run's `personas` + `{ audienceId: <active audience or null>, analysisId: <if a reading exists else null> }`.
- Keep it **non-fatal / content-first** — never block the card on the pin (the fn already swallows errors; just don't `await` in a way that delays render, or `void` it / fire-after-render).
- Add a **runner-level test** per runner asserting the pin is invoked with the right `personas` + `ctx` (the existing test only covers the fn in isolation).
- **General/null audience still pins** (reconciliation just won't propose for General — the confidence gate excludes it).
- Engine regression gate stays green; `ENGINE_VERSION` untouched (this is capture-path, not scoring).

### Acceptance
- Run a skill that fires the Flash SIM → an `outcome_signatures` row is written with the predicted vector + audience_id.
- Then the paste-posted-URL capture → reconcile path fires end-to-end (no longer dormant).
- Each wired runner has a test asserting `pinPredictedSignature` is called; full suite green.

> This naturally pairs with KCQ-05 (P14 SIM-rank loop) later, but it's a small standalone fix — do it now; it unblocks an inert moat feature.

---

## After both land
- Flip `UX-01` ✅ (already marked) — note the composer is BUILT (not just sketched).
- Then continue the milestone: **Phase 11 Explore** is next (`research/sandcastles-adopt-improve.md §PROPOSED PHASE STRUCTURE` is the authoritative shape). Sequencing flag: P14 KC-Grounding levers #1/#2 underpin P11 — decide precede-or-parallel.
- State of record: `STATE.md` (16 phases, 10 done), `ROADMAP.md` (11–16), `REQUIREMENTS.md`. Memory: `composer-ux01-locked`, `next-milestone-v7-locked`.
