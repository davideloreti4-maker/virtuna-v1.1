---
phase: 07-audience-as-front-door-surface
reviewed: 2026-06-29T11:30:12Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/components/app/home/composer-controls.tsx
  - src/components/audience-lens/audience-presence.tsx
  - src/lib/audience/audience-repo.ts
  - src/components/app/home/composer.tsx
  - src/components/app/home/build-chooser.tsx
  - src/app/(app)/audience/new/page.tsx
  - src/components/audience/audience-form.tsx
  - src/components/app/home/home-starter.tsx
  - src/app/(app)/home/page.tsx
  - src/components/app/brand-deals/earnings-chart.tsx
  - src/lib/audience/calibration.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-29T11:30:12Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the phase-07 "Audience-as-Front-Door" surface: the mode-gated skill SSOT
(`composer-controls`), the portaled audience switcher (`audience-presence`), the virtual
General/template constants + `cloneTemplateAudience` (`audience-repo`), the composer host
wiring (`composer`), the Build chooser, the `?mode=general` page + form, the home starter,
and the two orchestrator fixes (`earnings-chart`, `calibration`).

The phase's #1 constraint — **byte-identical Socials render** — holds: every Socials skill is
tagged `["socials"]`, `SkillRows` gates on the active mode defaulting to `"socials"`, the
composer derives `activeMode={selectedAudience?.mode ?? "socials"}` (null/General → socials),
and the switcher's General section is gated on `generalRows.length > 0` so a Socials-only
creator never sees it. **CR-01 (session-derived `user_id`) is solid**: `createAudience`
re-derives `user.id` from `supabase.auth.getUser()`, `audienceToRow` whitelists columns and
never reads input `user_id`/`id`, and `cloneTemplateAudience` strips the sentinel id + virtual
`user_id` before delegating. No injection, hardcoded secrets, unsafe deserialization, or
client/server boundary leaks found (`audience-repo` pulls only `zod` + `goal-intent`; the
`resolve-tier` leaf-import discipline is respected). The `Ico` `dangerouslySetInnerHTML` reads
only the static `ICONS` map — no user-controlled HTML. The portaled dropdown's listener
lifecycle (Escape, outside-click excluding the portal, scroll/resize re-anchor) is correctly
scoped to `switcherOpen` and cleaned up — no leaks.

No BLOCKERs. Four WARNINGs cluster around **mode/skill state consistency** in the composer —
the slash menu and active-tool reconciliation don't track the new audience mode the way the
skill pill does, producing wrong-skill-set and surprise-navigation cases for General audiences.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `/` slash command menu is not mode-gated (diverges from the skill pill)

**File:** `src/components/app/home/composer.tsx:1587`
**Issue:** The skill-pill popover threads the real mode (`activeMode={activeMode}` in
`composer-controls.tsx:510`), but the composer's slash-command menu renders
`<SkillRows active={activeTool} filter={slashQuery} onSelect={selectSkill} />` with **no
`activeMode` prop**, so it falls back to the `"socials"` default. On a General audience the
slash menu therefore shows the Socials skills (Ideas/Hooks/Script/…) instead of the three
General verbs (Profile/Simulate/Predict) — the exact inversion the mode gate exists to prevent.
Compounding it, `firstSlashSkill()` (`composer.tsx:1179`) searches **all** enabled `SKILLS`
with no mode filter, so typing `/simulate` + Enter selects a verb the menu never displayed.
(Byte-identical Socials is unaffected — the bug only manifests for General audiences.)
**Fix:**
```tsx
// composer.tsx:1587 — thread the same derived mode the pill uses
<SkillRows
  active={activeTool}
  filter={slashQuery}
  onSelect={selectSkill}
  activeMode={selectedAudience?.mode ?? "socials"}
/>
// and mode-filter firstSlashSkill so Enter can't pick an out-of-mode verb:
const mode = selectedAudience?.mode ?? "socials";
SKILLS.find((s) => s.enabled && s.modes.includes(mode) && (!q || …))
```

### WR-02: `activeTool` is never reconciled when the audience mode changes

**File:** `src/components/app/home/composer.tsx:590-610` (`handleSelectAudience`) — no
mode-change reset exists.
**Issue:** Selecting an audience updates `selectedAudienceId` (→ `activeMode`) but leaves
`activeTool` untouched, so the active skill and the active mode can disagree:
- **General → Socials switch:** a creator who picked `simulate`/`predict` on a General
  audience, then switches back to a Socials audience, keeps `activeTool === "simulate"`. The
  skill pill shows "Simulate" though the mode-gated menu lists only Socials skills, and on
  submit the simulate/predict path (`composer.tsx:1056`) sees `selectedAudience.mode !==
  "general"` and `router.push("/audience/new")` — **silently navigating away and discarding
  the draft the user just typed.**
- **Socials → General switch:** `activeTool` stays `"test"`; the pill shows "Test" with a
  "Paste a TikTok link…" placeholder while the menu offers only Profile/Simulate/Predict.

(Note: the HomeStarter "Predict an outcome" chip routing to Build when no General audience is
selected is *intended* per the chip comment; this finding is the un-handled cross-mode switch.)
**Fix:** In `handleSelectAudience`, when the new audience's mode no longer contains the current
`activeTool`'s mode, reset to a sensible default for that mode (e.g. `"test"` for socials, the
first General verb for general) so the pill, menu, placeholder, and submit path stay coherent.

### WR-03: `handleSubmit` closes over a stale `intent` (missing dependency)

**File:** `src/components/app/home/composer.tsx:1149-1150`
**Issue:** `handleSubmit` reads `intent` (passed to `ideas.start`/`hooks.start`/`script.start`/
`remix.start`) but `intent` is **absent from its `useCallback` dependency array** (guarded by an
`eslint-disable react-hooks/exhaustive-deps`). The callback is recreated when `trimmedUrl`
changes, which masks the bug whenever the user types — but on the **empty-field Auto paths
(Ideas/Hooks)** a user can open the intent popover, flip grow⇄sell (`intentOverride` re-render,
`trimmedUrl` unchanged), and submit: the memoized closure still carries the previous `intent`,
sending the **wrong reaction lens** to the engine. `askAudience` (`composer.tsx:1319`) correctly
lists `intent` in its deps — apply the same here.
**Fix:** Add `intent` to the `handleSubmit` dependency array (line 1150).

### WR-04: switcher Socials filter silently drops audiences whose mode isn't exactly `'socials'`

**File:** `src/components/audience-lens/audience-presence.tsx:204-208`
**Issue:** `socialsRows` is built as `[...baseline, ...templates, ...yours.filter((a) => a.mode
=== 'socials')]`. `groupAudiences` puts everything that isn't `mode==='general'`/`is_general`/
`is_preset` into `yours`, but the `=== 'socials'` equality filter then **excludes any `yours`
row whose `mode` is null/undefined** (e.g. a legacy row created before the `mode` column
backfill, or any value other than the literal `'socials'`). Such an audience would vanish from
the switcher entirely — invisible and unselectable — despite being the creator's own. This is a
silent visibility regression that depends on the migration having backfilled `mode` NOT NULL for
every pre-existing row.
**Fix:** Treat "not general" as socials rather than requiring strict equality:
```ts
...yours.filter((a) => a.mode !== 'general'),
```

## Info

### IN-01: dead `yours.filter(a => a.mode === 'general')` in `generalRows`

**File:** `src/components/audience-lens/audience-presence.tsx:209-212`
**Issue:** `groupAudiences` (audience-display.ts:140) routes **all** `mode==='general'`
audiences (virtual templates *and* saved user General SIMs) into `generalTemplates` before the
`is_preset`/`yours` branches, so `yours` can never contain a general-mode entry. The trailing
`...yours.filter((a) => a.mode === 'general')` is therefore always empty — dead code that
implies user General SIMs come from `yours` when they actually arrive via `generalTemplates`.
**Fix:** Drop the empty filter (generalRows = `[...generalTemplates]`) and update the comment, or
keep it only if `groupAudiences`' routing is expected to change.

### IN-02: `createAudience` validates `input` but writes from raw `input`, not `parsed.data`

**File:** `src/lib/audience/audience-repo.ts:450-461`
**Issue:** `WritableAudienceSchema.safeParse(input)` is checked for success, but the row is then
built with `audienceToRow(input, user.id)` using the **raw** object rather than `parsed.data`.
It's currently safe because `audienceToRow` whitelists columns and never reads `input.user_id`/
`id`, and a passing parse guarantees the raw values are within caps. Still, using `parsed.data`
would be the more defensive contract (Zod strips unknown keys and applies the `is_general`/
`is_preset` defaults), removing any reliance on `audienceToRow` staying perfectly in sync with
the schema. Same pattern in `updateAudience` (line 542).
**Fix:** Build the row from `parsed.data` instead of `input`.

### IN-03: `getSkill` silently falls back to "Ideas" for an unknown ToolId

**File:** `src/components/app/home/composer-controls.tsx:94-95`
**Issue:** `getSkill = (id) => SKILLS.find((s) => s.id === id) ?? SKILLS[1]!` returns the Ideas
meta for any id not in `SKILLS`. The union makes this unreachable today, but a silent
wrong-skill fallback (rather than a throw or an explicit "unknown" sentinel) could mask a future
typo/regression by rendering a plausible-but-wrong skill label/model.
**Fix:** Either narrow the parameter so the fallback is provably dead, or throw on the miss so a
bad id surfaces loudly in dev.

---

_Reviewed: 2026-06-29T11:30:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
