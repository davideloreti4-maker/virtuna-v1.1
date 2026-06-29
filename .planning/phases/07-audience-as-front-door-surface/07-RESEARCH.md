# Phase 7: Audience-as-Front-Door Surface - Research

**Researched:** 2026-06-29
**Domain:** In-repo Next.js 15 client-component UI surface wiring (no new engine, no new packages)
**Confidence:** HIGH (every claim is grounded in a file+line read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (UX-02):** Per-skill `modes[]` tag — the skill menu filters by the active Audience's `mode`. Each `SKILLS` entry declares `modes` (e.g. `['socials']` for Hooks/Test/Remix/Chat; `['general']` for Profile/Simulate/Predict). Smallest change to `composer-controls.tsx`; removes the one hardcoded `creator`/`marketing` split. No skill-registry refactor. **Rejected:** pack-declared verbs now; hardcoded `if mode==='general'`.
- **D-02 (UX-01):** Compact in-composer dropdown reusing the audience-manager rows, sectioned `── Socials ──` / `── General ──` via `groupAudiences()`, with `+ Build an audience` at the bottom. In-composer, no surface hop; creator opens to their personal audience pre-selected and never sees General unless they own General audiences. **Rejected:** full-screen takeover; always-visible segmented sections.
- **D-03 (UX-04):** One unified `+ Build an audience` entry → three paths (From a description = calibration form; From evidence = P5 `profile-runner`/profile-drop; From a template = clone a `GENERAL_TEMPLATE` into an editable owned SIM). All converge on a saved named General SIM in the library. Template = clone-and-edit. **Rejected:** three scattered entries; defer template path.
- **D-04 (UX-05):** The 3 locked chips + a one-tap pre-seeded profile-chat example. Render greeting + composer + the three fixed chips. First-run demo = a one-tap PRE-LOADED sample chat that runs Profile→Read. Show-once, dismissable, then home returns to plain greeting+chips. **Rejected:** chips-only; multi-step coachmark.
- **D-05 (scope cut):** Intent → success-criterion composer chip is DEFERRED (out of P7). Also OUT: Discover/Apify corpus surface; SIM marketplace; multi-stimulus/batch; `.docx`/`.pdf` ingest.
- **D-06 (UX-03):** Generalize the live ambient reactor to General audiences, reusing the existing mechanism. The active Audience reacts live as the user drafts for General too. `buildAudienceRepaint` already mode-agnostic. Person-SIM (1 persona) reacts as that one person; keep the existing Socials debounce/throttle; creator byte-identical. **Rejected:** Socials-only live; defer reactor generalization.

### Claude's Discretion
- The `modes[]` tag shape (string union vs enum) + exactly how `SkillRows` filters by `selectedAudience.mode` + the no-audience default (→ Socials, §16.2).
- The dropdown/popover primitive (reuse audience-manager card vs a compact list row) + exact anchor + how `+ Build an audience` renders.
- The Build chooser UI (modal vs inline step) + auto-naming + clone mechanics via `audience-repo` CRUD.
- The pre-seeded sample chat content + show-once mechanism (localStorage vs profile field) + dismiss affordance.
- The reactor rename/wiring (`audience` → "the active Audience") + person-SIM single-reactor framing + reuse of the existing throttle.
- Cross-mode thread behavior on mid-thread mode switch — default to existing thread behavior, do not special-case unless it breaks.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

### Deferred Ideas (OUT OF SCOPE)
- Intent → success-criterion composer chip (the `⊕grow`/`⊕reply-likely` affordance, §16.5 step 6).
- Discover / Apify corpus surface; brand vertical as a distinct surface tree; SIM marketplace + rev-share; self-calibration Directional→Validated; Anchor Pack #2.
- Multi-stimulus / batch; `.docx`/`.pdf` ingest.
- Cross-mode mid-thread behavior as an explicit feature.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Audience picker promoted to primary context-setter, sectioned by Mode (Socials / General) | The LIVE picker is the `AudiencePresence` switcher (presence.tsx L307–359), already in-composer; `groupAudiences()` (audience-display.ts L126–146) already buckets `mode==='general'` into `generalTemplates`. Add mode section headers + `+ Build an audience` to that switcher. See **Finding 1**. |
| UX-02 | Skill menu Mode-scoped; Socials creator default unchanged | `SKILLS` (composer-controls.tsx L61–71) tags `group: 'creator'\|'marketing'`; `SkillRows` (L198–286) filters by `group`. `ComposerControls` is NOT passed the audience/mode. Profile/Simulate/Predict are NOT in `SKILLS`. See **Finding 2** (the central planning risk). |
| UX-03 | Ambient reactor generalized; creator byte-identical | `AudiencePresence` already takes `audience: Audience \| null` and is fully audience-agnostic; `buildAudienceRepaint` (build-reaction-panel.ts L68–74) is already mode-agnostic. Largely a rename + confirming General drives it. See **Finding 4**. |
| UX-04 | "Build an audience": from-description / from-evidence / from-template | All three converge on `createAudience(supabase, {... mode:'general' ...})` (audience-repo.ts L445–475). Evidence path = `profile-runner` (already saves mode general, L260–275). Templates = `GENERAL_TEMPLATES` constant (L117–220). See **Finding 3**. |
| UX-05 | Home empty state seeds chips; first-run demo = profile-chat | `home/page.tsx` LOCKED-empty (L13–25); `home.test.tsx` actively asserts NO chips / NO demo and WILL BREAK. Profile entry = the evidence-drop affordance → `POST /api/tools/profile`. localStorage show-once precedent exists. See **Finding 5**. |
</phase_requirements>

## Summary

This is a **pure surface-wiring phase on an unusually mature codebase**. Every primitive the five requirements need already exists and has been read this session: the in-composer audience picker (the `AudiencePresence` switcher), `groupAudiences()` mode-bucketing, the `SKILLS` array + `SkillRows` filter, `createAudience` CRUD with a `mode:'general'` path, the `GENERAL_TEMPLATES` constants, the `profile-runner` evidence path, and a fully audience-agnostic ambient reactor. P7 is "connect and section what's already built," not "build new."

The research surfaced **one stale framing and one genuine gap** that the planner must resolve before writing tasks:

1. **The "retired AudienceChip" framing in CONTEXT is stale.** `composer.tsx` no longer imports `audience-chip.tsx` at all — audience switching was moved into `AudiencePresence` (the switcher popover at presence.tsx L307–359), which is already in-composer, already lists all audiences, and already has a "Manage audiences" footer. Resurrecting `audience-chip.tsx` would create **two competing pickers**. The smallest, correct D-02 move is to **enhance the existing `AudiencePresence` switcher** (add `groupAudiences()` section headers + a `+ Build an audience` row), not to promote the dead chip.

2. **Profile / Simulate / Predict are not skill-menu entries today** — they are reached via card-chain CTAs (`profile-read` card → "Simulate a message →" → `reaction-distribution` card → "Predict →") and the evidence-drop affordance, never via a skill pill. The `SKILLS` array / `ToolId` union contains only `test|idea|hooks|chat|script|remix|explore|offer|ad`. D-01's literal "`modes: ['general']` for Profile/Simulate/Predict" therefore requires **adding three new menu entries AND deciding what each does when selected** — Profile = open the evidence drop (not a topic submit), Simulate = needs a saved audience + a draft, Predict = needs a panel + scenario. This is the highest-risk planning question (see Pitfall 1).

**Primary recommendation:** Treat P7 as four small additive wirings — (a) thread `selectedAudience.mode` into `ComposerControls`/`SkillRows` and add the three general entries with explicit submit semantics; (b) add mode sections + Build entry to the `AudiencePresence` switcher; (c) a Build chooser that calls `createAudience`/`profile-runner`/template-clone; (d) unlock the home empty state with chips + a one-tap localStorage-gated profile demo. Guard the byte-identical creator path with new mode-filter unit tests and by updating the three tests that encode the now-obsolete locked-empty/group assumptions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audience picker sectioning (UX-01) | Frontend (client component) | — | `AudiencePresence` is `"use client"`; `groupAudiences()` is a pure presentation helper. No API change. |
| Mode-scoped skill menu (UX-02) | Frontend (client component) | — | `SKILLS`/`SkillRows` are client SSOT; filter is a render-time `.filter()`. No route change. |
| Build-an-audience paths (UX-04) | Frontend chooser | API/Backend (CRUD + runner) | The chooser is client; persistence is `createAudience` (lib) + `POST /api/tools/profile` (route). |
| Ambient reactor generalization (UX-03) | Frontend (client component) | API (`/api/tools/react`) | The reactor is a pure view onto `audience` + `focus`; the ask round-trip already exists server-side. |
| Home empty state + demo (UX-05) | Frontend (client component) | API (`/api/tools/profile`) | Greeting/chips/demo are client; the demo's Profile→Read uses the existing profile route. |

**Tier sanity note for the planner:** nothing in P7 belongs in the API tier as *new* logic. Every route the phase touches (`/api/audiences`, `/api/tools/profile`, `/api/tools/simulate`, `/api/tools/react`, `/api/threads/*`) already exists and is unchanged. If a task proposes a new route or engine call, it has drifted from the additive-wrap mandate.

## Standard Stack

No new dependencies. This phase reuses only in-repo modules. The relevant existing stack:

### Core (already installed — verified by import in the files read)
| Module / lib | Location | Purpose | Why it's the standard here |
|--------------|----------|---------|----------------------------|
| `AudiencePresence` | `src/components/audience-lens/audience-presence.tsx` | The live in-composer audience identity + switcher + reactor | It already owns switching (the chip was retired into it) — D-01/D-02/D-06 all attach here `[VERIFIED: file read]` |
| `groupAudiences()` | `src/components/audience/audience-display.ts` L126–146 | Buckets audiences → `{ baseline, templates, generalTemplates, yours }` by `mode`/`is_general`/`is_preset` | Already does the Socials/General split D-02 needs `[VERIFIED: file read]` |
| `SKILLS` / `SkillRows` / `ToolId` | `src/components/app/home/composer-controls.tsx` L32–286 | Skill-menu SSOT + the shared filterable row list (skill pill AND `/` slash menu) | The one hardcoded `group` site D-01 targets `[VERIFIED: file read]` |
| `createAudience` / `GENERAL_TEMPLATES` / `SENTINEL_IDS` | `src/lib/audience/audience-repo.ts` L117–227, L445–475 | CRUD + the analyst/hiring template constants + the zero-setup defaults | The single save target for all three Build paths `[VERIFIED: file read]` |
| `runProfile` | `src/lib/tools/runners/profile-runner.ts` L208–300 | Builds a person/panel General SIM from evidence and saves it (`mode:'general'`) | The from-evidence Build path — reuse, do not rebuild `[VERIFIED: file read]` |
| `AudienceForm` + `CalibrationFlow` | `src/components/audience/audience-form.tsx`, `calibration-flow.tsx` | The from-description build path | Already posts to `/api/audiences` `[VERIFIED: file read]` |
| `resolveTier` | `src/lib/audience/resolve-tier.ts` | Directional-by-rule honesty badge for General | The picker/cards carry it; unchanged `[VERIFIED: file read]` |
| `localStorage` | precedents: `use-lens-scale.ts`, `society-selector.tsx`, `anti-virality-header.tsx`, `verdict-constants.ts` | show-once persistence | Established in-repo pattern for D-04 show-once `[VERIFIED: grep]` |

**Installation:** none. `Installation: N/A — no packages added.`

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All work is in-repo wiring of existing modules. No `npm install`, no new `package.json` entries. The package-legitimacy gate does not apply.

## Architecture Patterns

### System Architecture Diagram (data flow for a P7 run)

```
                       ┌──────────────────────────────────────────────┐
   user picks/builds   │  AudiencePresence switcher (in-composer)      │
   an audience  ─────► │  L307–359: lists groupAudiences() sections    │
                       │  + "+ Build an audience"  (D-02)              │
                       └───────────────┬──────────────────────────────┘
                                       │ onSelectAudience(a)
                                       ▼
                       ┌──────────────────────────────────────────────┐
   composer.tsx state: │ selectedAudienceId → selectedAudience         │
   (already exists      │   .mode  ──────────────┬───────────┐         │
    L211–232)           │   (carries mode)       │           │         │
                       └───────────┬─────────────┘           │         │
                                   │ NEW: pass mode           │ pass audience
                                   ▼                          ▼
         ┌─────────────────────────────────────┐   ┌─────────────────────────┐
   D-01: │ ComposerControls → SkillRows         │   │ AudiencePresence reactor│ D-06
         │ filter SKILLS by modes[].includes(   │   │ buildDots(personas) +   │
         │   mode ?? 'socials')                 │   │ buildAudienceRepaint    │
         │ Socials → Hooks/Test/Remix/Chat      │   │ (already mode-agnostic) │
         │ General → Profile/Simulate/Predict   │   └─────────────────────────┘
         └──────────────┬──────────────────────┘
                        │ submit (per-skill semantics — Pitfall 1)
                        ▼
         existing routes: /api/tools/{profile,simulate,predict,react}, /api/audiences
                        │
                        ▼ (Build path D-03)
         createAudience(supabase, { mode:'general', ... })  ──► General library
```

### Recommended Project Structure (touch map — files that change, all existing)
```
src/components/app/home/
├── composer-controls.tsx   # D-01: add `modes` to SkillMeta + 3 general ToolIds; thread `mode` into SkillRows
├── composer.tsx            # D-01 wiring (pass mode); D-03 Build chooser host; D-04 demo seed
└── home-page-layout.tsx    # D-04: render chips + demo in the empty-state block
src/app/(app)/home/page.tsx # D-04: drop the LOCKED-empty doc-comment; chips now allowed
src/components/audience-lens/
└── audience-presence.tsx   # D-02: section the switcher via groupAudiences() + add Build entry; D-06 rename
src/components/audience/
├── audience-display.ts     # (reuse groupAudiences() — likely no change)
└── (new) build-chooser     # D-03: small chooser → 3 paths (modal or inline step — discretion)
src/lib/audience/audience-repo.ts # D-03: a thin clone helper (or call createAudience with template fields)
```

### Pattern 1: Mode-scoped filter as a render-time `.filter()` (D-01)
**What:** Add `modes: SkillMode[]` (or a `('socials'|'general')[]`) field to `SkillMeta`; in `SkillRows`, replace the `group === 'creator'`/`'marketing'` partition with a `modes.includes(activeMode)` filter, defaulting `activeMode` to `'socials'` when no audience is selected.
**When to use:** This is the locked D-01 shape. Keep `group` if the Socials sub-grouping (Creator vs Marketing headers) is still wanted inside the Socials section; `mode` is the outer filter, `group` the inner header.
**Example (current code that changes):**
```typescript
// Source: src/components/app/home/composer-controls.tsx L208–211 (CURRENT)
const match = (s: SkillMeta) =>
  !q || s.label.toLowerCase().includes(q) || s.command.includes(q);
const creator = SKILLS.filter((s) => s.group === "creator" && match(s));
const marketing = SKILLS.filter((s) => s.group === "marketing" && match(s));
// → D-01: gate the whole list on the active mode first:
//   const inMode = (s) => s.modes.includes(activeMode ?? "socials");
//   then partition the in-mode set by group for the Socials sub-headers.
```
Note: `ComposerControls` (L324–347 props) and `SkillRows` (L198–206 props) currently receive **no** audience/mode — the new `mode` prop must be threaded from `composer.tsx` (which already has `selectedAudience.mode` available at L224).

### Pattern 2: Enhance the live switcher, don't resurrect the chip (D-02)
**What:** The audience switcher already renders an audience list with a footer in `AudiencePresence` (presence.tsx L307–359). Replace its flat `audiences.map(...)` with `groupAudiences(audiences)` and render `── Socials ──` (baseline + templates + yours where `mode==='socials'`) and `── General ──` (`generalTemplates` + general-mode `yours`) section headers, then change the footer `Manage audiences →` link into / alongside a `+ Build an audience` entry that opens the Build chooser.
**When to use:** This IS the D-02 implementation. Do NOT re-mount `audience-chip.tsx`.
**Example (the live switcher list that changes):**
```typescript
// Source: src/components/audience-lens/audience-presence.tsx L320–347 (CURRENT — flat map)
{audiences.map((a) => { /* one row per audience, no mode header */ })}
// → D-02: const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);
//   render a "Socials" header over socials-mode rows, a "General" header over generalTemplates
//   + general-mode yours, then a "+ Build an audience" row.
```

### Pattern 3: All Build paths converge on `createAudience(..., { mode:'general' })` (D-03)
**What:** Three entries, one save target.
**Example (the canonical save the evidence path already performs):**
```typescript
// Source: src/lib/tools/runners/profile-runner.ts L260–275 (the from-evidence path, ALREADY mode:'general')
const saved: Audience = await saveAudience(supabase, {
  name: subjectName.slice(0, MAX_AUDIENCE_NAME),
  type: "target", platform: "custom", mode: "general",
  signature: bakeResult.signature,
  personas: signatureToCalibratedPersonas(bakeResult.signature),
  custom_context: [{ source: "user", persona_evidence_link: "__subject_kind", note: bakeResult.subjectKind }],
});
// from-template clone (D-03): read a GENERAL_TEMPLATES entry, strip its sentinel id, call createAudience
// with mode:'general' + the template's personas/persona_weights/success_criterion → an editable owned SIM.
// from-description: the existing AudienceForm POST /api/audiences — set mode:'general' for a General build.
```
**Gotcha:** `WritableAudienceSchema` (audience-repo.ts L258–288) accepts `mode`, `success_criterion`, `custom_context`, `personas`, `persona_weights`, `signature` — so a template clone is a single validated `createAudience` call. `SENTINEL_IDS` (L223) must be stripped (never insert a sentinel id).

### Pattern 4: localStorage show-once for the demo (D-04)
**What:** Gate the one-tap profile-chat demo behind a `localStorage` flag (precedent: `use-lens-scale.ts`, `society-selector.tsx`). On tap, run Profile→Read with a canned chat fixture through the existing evidence-drop path (`POST /api/tools/profile`), then set the flag so it never re-shows.
**When to use:** D-04 is "show-once, dismissable." A profile-field alternative needs a DB write + `useProfile` round-trip; localStorage is the lighter, established pattern — recommend it unless cross-device persistence is required (it is not, per D-04).

### Anti-Patterns to Avoid
- **Re-mounting `audience-chip.tsx`** → creates a second picker alongside the live `AudiencePresence` switcher. The chip is dead code; treat its 286 lines as a *reference* for dropdown markup only.
- **A new `if (mode === 'general')` branch in `SkillRows`** → exactly the hardcoded fork D-01 exists to remove. Use the `modes[]` tag.
- **Adding Profile/Simulate/Predict as topic-submit skills without per-skill submit semantics** → Profile is an evidence drop, not a topic field; wiring it like Hooks would break the wow (see Pitfall 1).
- **A new route or engine call** → P7 is additive surface wiring; ENGINE_VERSION stays `3.20.0` (audience-regression-gate.test.ts L48 asserts it).
- **Touching the Socials submit/skill path** → the creator composer must stay byte-identical (Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sectioning audiences by mode | A new grouping reducer | `groupAudiences()` (audience-display.ts L126) | Already buckets `mode==='general'` correctly + handles the `is_general`/`is_preset` collision traps (the `GENERAL_AUDIENCE` is `mode:'socials'`, Pitfall 1 in that file) |
| Saving a built General SIM | A bespoke insert | `createAudience()` (audience-repo.ts L445) | Zod-validated, CR-01 session-derived `user_id`, RLS-scoped |
| Building a SIM from a chat export | A new profile flow | `runProfile()` / the evidence-drop affordance | Already bakes signature + saves `mode:'general'` + persists the `__subject_kind` marker |
| The popover/dropdown shell | A new popover | The `AudiencePresence` switcher (already open/Escape/outside-click wired) OR the `Popover` in composer-controls.tsx L154 | Both already handle outside-click + Escape + upward-open |
| Trust badge on the picker rows | A new tier check | `resolveTier(audience)` | Directional-by-rule for General, already used by `AudienceCard` |
| show-once persistence | A new mechanism | `localStorage` (4 in-repo precedents) | Established pattern |

**Key insight:** the single biggest risk in this phase is *over-building* — every "new" thing the requirements describe already has a home in the codebase. The research effort is mapping requirements to existing seams, which this document does.

## Runtime State Inventory

P7 is **not** a rename/refactor/migration phase — it is additive UI wiring. No stored data keys, OS registrations, or secrets are renamed. Two near-adjacent items worth an explicit note:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Built General SIMs persist to the `audiences` table via `createAudience` (existing column set; `mode`/`success_criterion`/`custom_context` already present per `AudienceRow` L292–317). No schema change. | None — columns exist |
| Live service config | None | None — verified: no external service config touched |
| OS-registered state | None | None |
| Secrets/env vars | None | None — no new routes, no new keys |
| Build artifacts | `database.types.ts` is still cast-around (`(supabase as any)` per audience-repo.ts L13–17 comment) — pre-existing debt, NOT introduced by P7 | None for P7 (do not regenerate as part of this phase) |

**Nothing found requiring data migration.** Verified by reading `audience-repo.ts` (columns already support `mode:'general'` SIMs) and `profile-runner.ts` (already writes them).

## Common Pitfalls

### Pitfall 1: Profile/Simulate/Predict have no skill-submit semantics (the central D-01 gap)
**What goes wrong:** D-01 says tag Profile/Simulate/Predict `modes:['general']`. But these three are **not** in `SKILLS`/`ToolId` today, and `composer.tsx handleSubmit` has **no branch** for them. Profile is triggered by the evidence-drop affordance (`POST /api/tools/profile`), Simulate by the `profile-read` card's "Simulate a message →" CTA (`/api/tools/simulate`), Predict by the `reaction-distribution` card's chain CTA (`/api/tools/predict`). They are a **card-chain**, not topic-field submits.
**Why it happens:** P5/P6 built these as chained CTAs (the wow is one continuous thread), deliberately not as composer skills. The skill menu was never their entry point.
**How to avoid:** The planner must decide, per skill, what selecting it from the General menu DOES:
- **Profile** → most likely: focus/open the evidence-drop affordance (the `Attach a chat or screenshot` input, composer.tsx L1596–1615) and set the General-appropriate placeholder. It is NOT a text submit.
- **Simulate** → requires a selected General audience; the field becomes "type a draft message" → `POST /api/tools/simulate` with `audienceId = selectedAudience.id`. Today simulate is only reachable from a profile-read card carrying `savedAudienceId`; selecting it as a skill means wiring a direct submit that reads `selectedAudienceId`.
- **Predict** → requires a panel audience + scenario; today only reachable from a `reaction-distribution` card. A direct menu entry needs a submit that targets `/api/tools/predict` with the panel id.
**Warning signs:** A plan that adds the three ToolIds but routes them through the generic `handleSubmit` topic path — that ships a broken General composer. Recommend the planner add a `## Build-an-audience first` discipline: General Simulate/Predict only make sense once a General audience is selected (§16.4 asymmetry), and Profile is the door that creates one.
**Confidence:** HIGH `[VERIFIED: file read of composer.tsx handleSubmit L833–986 + reaction-distribution-block.tsx L49–84 + profile-read-block.tsx L48–81]`

### Pitfall 2: The byte-identical creator path is easy to break in three places
**What goes wrong:** Promoting the picker, adding the mode filter, or generalizing the reactor can each alter the Socials render path.
**Why it happens:** All three touch shared components (`ComposerControls`, `AudiencePresence`, the home layout) that the creator uses unchanged.
**How to avoid (the three guards):**
1. **Skill menu:** when `mode` is absent/`'socials'`, `SkillRows` must render the *exact same* Socials skills in the *exact same* order as today. The default must be `'socials'` (§16.2). Add a unit test asserting the Socials menu is unchanged.
2. **Picker:** the creator with only a personal/General socials audience must never see a `── General ──` section (it is empty for them) and the switcher's default-selected row must be unchanged.
3. **Reactor:** `buildAudienceRepaint` returns `undefined` for `is_general`/empty-personas (build-reaction-panel.ts L71) → the Flash path omits the arg → byte-identical no-op. Do not change this branch. The engine regression gate (audience-regression-gate.test.ts) and `reskin-matte.test.ts` already lock the engine + visual bytes.
**Warning signs:** Any diff to the Socials branch of `handleSubmit`, or a `SKILLS` reorder, or a change to the `audienceRepaint === undefined` condition.
**Confidence:** HIGH `[VERIFIED: file read]`

### Pitfall 3: Three existing tests encode now-obsolete assumptions and WILL fail
**What goes wrong:** `home.test.tsx` (L109–124) asserts **NO starter chips** (D-18) and **NO demo** (D-25). `composer-controls.test.tsx` (L54–64) asserts the menu shows literal **"Creator" / "Marketing"** group headers. These were correct pre-P7 and are exactly what P7 changes.
**Why it happens:** P5 deliberately locked the home empty (D-18/D-25, "demo is Phase 5"); P7 is where it unlocks.
**How to avoid:** The plan must include tasks to UPDATE these tests (not delete the guard intent): `home.test.tsx` → assert the 3 locked chips + the one-tap demo render; `composer-controls.test.tsx` → assert mode-scoped rendering (Socials shows creator skills, General shows Profile/Simulate/Predict). Treat the test update as part of the feature task, not an afterthought.
**Warning signs:** A green local run that's actually masking these — remember `npm test`/`npx vitest` print fake PASS(0); use `node ./node_modules/vitest/vitest.mjs run`.
**Confidence:** HIGH `[VERIFIED: file read of both test files]`

### Pitfall 4: "Reacts live as you draft" (D-06) vs the current explicit-ask reactor
**What goes wrong:** The current reactor reacts on (a) card focus via scroll-spy and (b) an **explicit submit** into audience-chat mode (`askAudience`, composer.tsx L1188–1219, uses an `AbortController` to cancel in-flight, not a keystroke debounce). There is no per-keystroke live reaction today.
**Why it happens:** P13's redesign made the composer field the audience-chat input on explicit send.
**How to avoid:** Clarify the D-06 bar. The §15.3 mock ("Alex's profile reacts live as you draft") could be satisfied by the existing focus/ask mechanism generalized to General (low risk), OR it could mean a debounced keystroke reaction (new behavior + cost). Recommend the former for P7 (reuse the existing throttle = the `AbortController` cancel) and flag keystroke-live as a possible follow-up — the CONTEXT D-06 explicitly says "reusing the existing mechanism" and "keep the existing Socials debounce/throttle," which points at reuse, not a new live loop.
**Confidence:** MEDIUM (the requirement wording leaves the "live" bar slightly open) `[VERIFIED: askAudience implementation read]`

### Pitfall 5: `mode` collision traps in the audience constants
**What goes wrong:** `GENERAL_AUDIENCE` and the two `PRESET_AUDIENCES` are `mode:'socials'`, NOT `'general'` (audience-repo.ts L44, L74, L92). Only `GENERAL_TEMPLATES` (analyst/hiring) are `mode:'general'`. A naive "General section = everything with 'General' in the name" would mis-bucket the baseline.
**Why it happens:** `is_general` marks the default weight mix, not the domain (the L41–43 comment spells this out).
**How to avoid:** Use `groupAudiences()` verbatim — it already routes `mode==='general'` FIRST (L140) before the `is_general` check, so the baseline stays in the Socials section. Do not re-derive sectioning.
**Confidence:** HIGH `[VERIFIED: file read]`

## Code Examples

### Threading mode into the skill menu (D-01)
```typescript
// Source: src/components/app/home/composer.tsx L224 (mode is already available)
const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;
// selectedAudience.mode is "socials" | "general"; default to "socials" when null (§16.2).
// Pass it down: <ComposerControls activeMode={selectedAudience?.mode ?? "socials"} ... />
//   then ComposerControls → <SkillRows activeMode={activeMode} ... />
//   then in SkillRows: SKILLS.filter((s) => s.modes.includes(activeMode) && match(s))
```

### Sectioning the live switcher (D-02)
```typescript
// Source: src/components/audience/audience-display.ts L126–146 (reuse verbatim)
const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);
// Socials section: baseline + templates + yours.filter(a => a.mode === "socials")
// General section: generalTemplates + yours.filter(a => a.mode === "general")
```

### Cloning a template into an owned SIM (D-03)
```typescript
// Source: src/lib/audience/audience-repo.ts — GENERAL_TEMPLATES L117 + createAudience L445
const tpl = GENERAL_TEMPLATES.find((t) => t.id === chosenTemplateId)!;
const { id: _sentinel, user_id: _v, created_at: _c, updated_at: _u, ...cloneable } = tpl;
await createAudience(supabase, { ...cloneable, name: derivedEditableName }); // mode:'general' preserved
```

## State of the Art

| Old Approach (pre-P7) | Current Approach (P7 target) | When Changed | Impact |
|-----------------------|------------------------------|--------------|--------|
| Audience switching in a composer chip (`audience-chip.tsx`) | Switching in `AudiencePresence` (the chip retired into it, P13 fork #3) | P13 (pre-P7) | D-02 enhances the *presence switcher*, not the chip |
| Home empty state LOCKED empty (D-18/D-25) | Greeting + 3 chips + one-tap demo (D-04) | P7 | `home.test.tsx` must be updated |
| Skill menu partitioned by `group: creator/marketing` | Filtered by the active audience's `mode` | P7 | `composer-controls.test.tsx` must be updated |
| Profile/Simulate/Predict via card-chain CTAs only | Also surfaced as General skill-menu entries | P7 | Requires per-skill submit semantics (Pitfall 1) |

**Deprecated/outdated:**
- `src/components/app/home/audience-chip.tsx` — dead code (not imported by `composer.tsx`). Use as markup reference only; do not re-mount.
- The CONTEXT readiness-survey line "the `AudienceChip` is wired but retired ~L103–104" — the chip is fully unmounted (switching lives in `AudiencePresence`). See Assumptions Log A1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The correct D-02 surface is the live `AudiencePresence` switcher, not the retired `audience-chip.tsx`; resurrecting the chip would double the picker. | Summary / Finding 1 / Pattern 2 | LOW — verified `composer.tsx` does not import the chip and renders the presence switcher; but if the founder specifically wants the chip's compact pill look, the markup is reusable. Either way the *behavior* attaches to the presence switcher's selection state. `[ASSUMED]` that the founder accepts enhancing the switcher over reviving the chip. |
| A2 | D-06 "reacts live as you draft" is satisfied by reusing the existing focus/ask mechanism for General (not a new keystroke-debounce loop). | Pitfall 4 | MEDIUM — if the founder wants true per-keystroke live reaction, that is new behavior + cost not scoped here. CONTEXT wording ("reusing the existing mechanism," "keep the existing throttle") supports reuse. `[ASSUMED]` |
| A3 | Selecting "Profile" from the General skill menu should open the existing evidence-drop affordance rather than submit the text field. | Pitfall 1 | MEDIUM — this is a UX decision the planner/discuss may want to confirm; the alternative (a dedicated Profile field) is more build. `[ASSUMED]` |
| A4 | localStorage (not a profile DB field) is the right show-once mechanism for the demo. | Pattern 4 / D-04 | LOW — D-04 explicitly lists both as discretion; localStorage matches in-repo precedent and D-04's single-device "show-once." `[ASSUMED]` |

## Open Questions

1. **What does selecting Profile / Simulate / Predict from the General skill menu submit?** (Pitfall 1)
   - What we know: routes exist (`/api/tools/{profile,simulate,predict}`); today reached via evidence-drop + card-chain CTAs, not the menu.
   - What's unclear: the per-skill composer submit semantics (Profile = evidence drop; Simulate/Predict = need a selected audience/panel + draft/scenario).
   - Recommendation: planner defines explicit submit behavior per general skill; gate Simulate/Predict on a selected General audience (§16.4 asymmetry); Profile opens the evidence drop. Consider a discuss-phase confirm.

2. **Is the D-06 "live" bar keystroke-live or reuse-the-existing-ask?** (Pitfall 4 / A2)
   - What we know: current reactor reacts on focus + explicit ask (AbortController throttle), not per-keystroke.
   - What's unclear: whether §15.3's "reacts live as you draft" demands a new debounced loop.
   - Recommendation: reuse the existing mechanism for General in P7; track keystroke-live as a possible follow-up.

3. **From-description Build: does the chooser reuse the full `/audience/new` `AudienceForm` (a surface hop) or an in-composer mini-form?** D-02 says "no surface hop," but the from-description path is the existing full-page form.
   - Recommendation: for the description path specifically, a surface hop to `/audience/new` (pre-set `mode:'general'`) may be acceptable since it's a deliberate "build" action, not the everyday picker; OR embed a slim form in the chooser. Planner's call; flag for discuss if ambiguous.

## Environment Availability

**SKIPPED — no external dependencies.** This phase is client-component wiring of existing in-repo modules and existing API routes. No new tools, services, runtimes, or CLIs are introduced. The only execution dependency is the existing test runner, invoked as `node ./node_modules/vitest/vitest.mjs run` (the repo's documented vitest shim; `npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

## Validation Architecture

> nyquist_validation is ENABLED (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (+ @testing-library/react for `.tsx`) |
| Config file | repo vitest config (existing; tests run today) |
| Quick run command | `node ./node_modules/vitest/vitest.mjs run <path>` |
| Full suite command | `node ./node_modules/vitest/vitest.mjs run` |

**CRITICAL:** `npm test` and `npx vitest` emit fake `PASS(0)/FAIL(0)` (a known rtk shim issue) — they must NOT be used as the gate. Always use the `node ./node_modules/vitest/vitest.mjs run` form.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Switcher renders `── Socials ──` / `── General ──` sections + `+ Build an audience` | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/audience-lens/__tests__/audience-presence.test.tsx` | ⚠️ exists — extend for sections |
| UX-02 | Socials audience → creator skills only (byte-identical order); General audience → Profile/Simulate/Predict | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer-controls.test.tsx` | ⚠️ exists — must UPDATE (asserts Creator/Marketing today) |
| UX-02 (guard) | No-audience default = Socials menu unchanged (byte-identical creator path) | unit (tsx) | same file | ❌ Wave 0 — add the default-Socials assertion |
| UX-03 | Reactor renders for a General audience; `buildAudienceRepaint` stays `undefined` for General/empty (no-op) | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/flash/__tests__` + presence test | ⚠️ extend |
| UX-03 (guard) | Engine bytes unchanged: ENGINE_VERSION `3.20.0`, General injects no override | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/audience-regression-gate.test.ts` | ✅ exists (BLOCKING) — keep green |
| UX-04 | Template clone → `createAudience` with `mode:'general'`, sentinel id stripped; all 3 paths save a named General SIM | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/audience-repo.test.ts` | ⚠️ extend (or new clone-helper test) |
| UX-05 | Home empty state renders the 3 locked chips + one-tap demo; show-once hides on second mount | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/home.test.tsx` | ⚠️ exists — must UPDATE (asserts NO chips/NO demo today) |
| Creator byte-identical (cross-cut) | No coral/glass regressions on the transplanted surfaces | unit | `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` | ✅ exists — keep green |

### Sampling Rate
- **Per task commit:** the touched component's unit test, e.g. `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer-controls.test.tsx` (< 30s).
- **Per wave merge:** `node ./node_modules/vitest/vitest.mjs run src/components/app/home src/components/audience-lens src/components/audience src/lib/audience src/lib/engine`.
- **Phase gate:** full suite `node ./node_modules/vitest/vitest.mjs run` green + a real browser pass (see UI note below) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `composer-controls.test.tsx` — UPDATE: replace the Creator/Marketing-header assertions with mode-scoped assertions + a no-audience-default-Socials assertion (covers UX-02 + the byte-identical guard).
- [ ] `home.test.tsx` — UPDATE: replace the NO-chips/NO-demo assertions with the 3-chips + one-tap-demo + show-once assertions (covers UX-05).
- [ ] `audience-presence.test.tsx` — EXTEND: assert mode sections + `+ Build an audience` row (covers UX-01) and that a General audience drives the reactor (covers UX-03).
- [ ] `audience-repo.test.ts` (or a new `build-clone.test.ts`) — ADD: template-clone produces a `mode:'general'` owned SIM with the sentinel id stripped (covers UX-04).
- [ ] **Browser-pass reminder (MEMORY: UI verify needs browser pass):** vitest (node) cannot catch Next client/server bundle leaks. A real authed browser pass of `/home` (picker sections, mode-scoped menu, Build chooser, demo) is required before marking UI tasks done — this caught a prior GSI bundle leak that all suites missed.

## Security Domain

> `security_enforcement` not disabled in config → included. Scope is light: this is additive client UI over existing, already-hardened routes.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; `(app)` layout gate unchanged |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes (inherited) | `createAudience`/`updateAudience` derive `user_id` from session (CR-01, audience-repo.ts L455–459, L493–497) + RLS `audiences_all_own`. The Build paths MUST reuse these — never pass a client `user_id`. |
| V5 Input Validation | yes | `WritableAudienceSchema` (Zod, L258–288) caps `name` 80, `success_criterion`/`custom_context.note` 2000, `custom_context` array 50. Template clone + description build go through it. The route is the trust boundary; client checks are UX-only. |
| V6 Cryptography | no | None |

### Known Threat Patterns for {Next.js client UI + Supabase}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored-XSS via audience name / success_criterion / grounding notes | Tampering | Existing Zod length caps + React's default escaping; do not add `dangerouslySetInnerHTML` to picker/Build UI |
| IDOR on a cloned/built SIM | Elevation | Reuse `createAudience` (session-derived `user_id` + RLS); never accept `user_id`/`id` from the client; strip `SENTINEL_IDS` on clone |
| Client/server bundle leak (a lib that pulls Node `dns`/apify into a `"use client"` component) | — (build break) | Precedent: `resolve-tier.ts` imports the leaf `SOCIALS_CALIBRATION`, NOT the pack barrel, to avoid BUILD-01. Any new picker/Build import must avoid heavy engine barrels. Browser pass catches it. |

## Sources

### Primary (HIGH confidence — files read this session)
- `src/components/app/home/composer-controls.tsx` (full) — SKILLS/SkillRows/ToolId, the hardcoded group split, ComposerControls props
- `src/components/app/home/composer.tsx` (full) — audience state, handleSubmit per-skill branches, AudiencePresence wiring, evidence-drop, demo seam
- `src/components/audience-lens/audience-presence.tsx` (full) — the LIVE switcher (the real picker), reactor view
- `src/components/audience-lens/ambient-presence-types.ts` (full) — AmbientPresenceProps/AmbientFocus
- `src/lib/engine/flash/build-reaction-panel.ts` (full) — buildAudienceRepaint (mode-agnostic, byte-identical no-op)
- `src/components/audience/audience-display.ts` (full) — groupAudiences, getCalibrationStatus
- `src/lib/audience/audience-repo.ts` (full) — createAudience/CRUD, GENERAL_TEMPLATES, SENTINEL_IDS, WritableAudienceSchema, AudienceRow columns
- `src/components/audience/audience-manager.tsx` (full) — section rendering precedent, AudienceCard usage
- `src/components/audience/audience-form.tsx` (full) + `src/app/(app)/audience/new/page.tsx` — from-description path
- `src/lib/tools/runners/profile-runner.ts` (L208–300) — from-evidence path, the canonical mode:'general' save
- `src/lib/audience/resolve-tier.ts` (full) — Directional-by-rule + BUILD-01 import discipline
- `src/app/(app)/home/page.tsx`, `home-greeting.tsx`, `home-page-layout.tsx` (full) — the LOCKED-empty home
- `src/components/audience/audience-card.tsx` (props), `audience-chip.tsx` (full, confirmed dead)
- Test files read: `composer-controls.test.tsx`, `home.test.tsx`, `audience-regression-gate.test.ts`, `reskin-matte.test.ts`
- `reaction-distribution-block.tsx` / `profile-read-block.tsx` (grep) — confirming the Simulate/Predict card-chain
- `.planning/NUMEN-GSI-VISION.md` §15–16 (read), `.planning/REQUIREMENTS.md` (UX-01..05), `.planning/phases/07-…/07-CONTEXT.md`

### Secondary (MEDIUM)
- `MEMORY.md` entries: "UI verify needs browser pass" (GSI P3 bundle-leak precedent), "vitest rtk shim" (the runner gotcha) — both corroborated by in-repo file comments

### Tertiary (LOW)
- None — no WebSearch/external sources used; this is an internal-codebase research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module verified by direct file read
- Architecture / touch map: HIGH — file+line grounded
- Pitfalls: HIGH (Pitfalls 1,2,3,5), MEDIUM (Pitfall 4 — requirement wording leaves the "live" bar slightly open)
- Open questions: the three above are genuine design decisions for the planner/discuss, not research gaps

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable — internal codebase; re-verify only if P5/P6 surfaces change before P7 starts)
