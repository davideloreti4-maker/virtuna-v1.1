# Phase 7: Audience-as-Front-Door Surface - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Promote the **Audience picker to the primary front-door context-setter** that ties the three verbs (Profile / Simulate / Predict) together — Mode-scoped skills + a generalized ambient reactor + a wow-seeded empty state — with the **creator (Socials) experience byte-identical**. This is the surface phase that makes the generality built in P1–P6 *reachable*; it adds **no new engine, no new verb** (UX-01..05).

**The core move (VISION §15.1):** do NOT bolt Profile/Simulate/Predict pills next to Hooks/Test/Remix — that collapses the composer. The **Audience becomes the context-setter** and skills/reactor scope to it, so you never show Hooks AND Predict at once. This *reduces* on-screen choices.

**Depends on:** P3 (General audience + `mode` + `groupAudiences` + General library + `GENERAL_TEMPLATES` + `resolveTier`), P5 (Profile-drop / `profile-runner` — the from-evidence build path + the reaction-distribution wow it surfaces), P6 (Predict — the third General skill the menu must expose). **This is the last phase of v7.0.**

**Carry-forward (LOCKED by VISION §15–16 + prior phases — NOT re-asked):**
- **Audience = primary context-setter; NO new pills.** Mode is a *section header inside the picker*, not a separate control (§15.1/§16.1).
- **Creator/Socials composer stays byte-identical** — generality lives *behind* the Audience picker; creator just sees their audience pre-selected (every phase's locked constraint; VISION §15.2).
- **General skill set = Profile / Simulate / Predict**; Socials keeps Hooks/Test/Remix/Chat (§16.1).
- **Zero-setup defaults** — Socials default = the `General-10` baseline (`is_general`); General default = a built-in template panel (analyst/hiring) so nothing requires setup (§16.2).
- **Empty-state chip copy is fixed:** `[Test an idea on your audience] [Profile a chat] [Predict an outcome]`; first-run demo = the profile-chat moment (§15.5).
- **Honesty spine** — Validated/Directional by rule (`resolveTier`); General is Directional. Carried from P3.
- **Reuse the audience-manager UI** for the picker (§16.5 step 1); all P7 work is additive/wrap-don't-refactor.

</domain>

<decisions>
## Implementation Decisions

### Skill-menu generalization (UX-02 — the one hardcoded-socials site)
- **D-01: Per-skill `modes[]` tag — the menu filters by the active Audience's `mode`.** Each entry in the `SKILLS` array declares which modes it appears in (e.g. `modes: ['socials']` for Hooks/Test/Remix/Chat; `modes: ['general']` for Profile/Simulate/Predict); the menu renders only skills whose tag includes `selectedAudience.mode`. This is **pack-driven enough** — a future brand/analyst pack's skills register by declaring their mode tag — with **no skill-registry refactor**, the smallest change to `composer-controls.tsx`, and it directly removes the one place the surface hardcodes a `creator`/`marketing` split that never reads the audience. The door stays open: upgrading to fully pack-declared (`pack[mode].skills`) later is a trivial move because the tag IS the seam. **Rejected:** pack-declared verbs now (moves the skill source-of-truth into pack objects that don't exist yet — over-builds ahead of a third pack); hardcoded `if mode==='general'` filter (ships fast but bakes the two-vertical fork — the exact hardcoded-socials risk this milestone exists to remove).

### Picker promotion (UX-01 — content locked by §16.1, only the form was open)
- **D-02: Compact in-composer dropdown that reuses the audience-manager rows.** Promote the currently-retired `AudienceChip` into a dropdown/popover anchored in the composer's left control cluster (where the chip lived), opening the **existing audience-manager card rows**, sectioned `── Socials ──` / `── General ──` via the already-built `groupAudiences()`, with **`+ Build an audience`** at the bottom (§16.1 structure verbatim). It stays **in-composer — no surface hop** — so the creator path is byte-identical (creator opens to their personal audience pre-selected, never sees the General section unless they have General audiences). **Rejected:** full-screen takeover picker (a surface-hop that risks the locked creator path and over-builds — the audience-manager *page* already exists for full browsing); inline always-visible segmented sections (clutters the slim composer, fights §15.1's "reduce on-screen choices").

### Build-an-audience (UX-04)
- **D-03: One unified `+ Build an audience` entry → three paths, all producing a saved, named General SIM.** The entry opens a small chooser: **From a description** (the existing calibration-from-description flow), **From evidence** (routes to **P5's `profile-runner` / profile-drop** → person/panel bake — reuse, not rebuild), **From a template** (clone a `GENERAL_TEMPLATE` into an **editable owned SIM**). All three converge on a saved General audience in the library — consistent with §16.4's "Profile = build a General Audience from evidence; the door into General that fills the library for later Simulate/Predict." **Template = clone-and-edit** (turns today's select-only presets into owned SIMs, the moat object), not select-only. **Rejected:** three scattered entry points (fragments the "build" mental model across the form / composer / manager); defer the template path (UX-04 lists it explicitly and clone-and-edit is cheap — templates already exist in `audience-repo.ts`).

### Empty-state & first-run demo (UX-05 — chip copy locked by §15.5)
- **D-04: The 3 locked chips + a one-tap pre-seeded profile-chat example.** Render the greeting + composer + the three fixed chips. The "first-run demo" is a **one-tap PRE-LOADED sample chat** that runs Profile→Read so a **cold-start user sees the wow without needing their own chat export** (the most visceral horizontal moment first, §15.5). **Show-once, dismissable**, then the home returns to plain greeting+chips. The home empty state was deliberately LOCKED empty in P5 (D-18/D-25, "demo is Phase 5") — P7 is where it unlocks. **Rejected:** chips-only (the wow is gated behind the user having a chat export handy → doesn't land on cold start — under-delivers §15.5); a multi-step guided coachmark walkthrough (over-built, brittle, off-style).

### Ambient reactor (UX-03)
- **D-06: Generalize the live ambient reactor to General audiences, reusing the existing mechanism.** The active Audience reacts **live as the user drafts** for General too — the §15.3 "Alex's profile reacts live as you draft" moat-touch on the exact profile-chat wow surface. This is the rename+wiring §16.5 step 3 calls for; `buildAudienceRepaint` is **already pack-driven/audience-aware** (P5 survey), so generalizing is wiring, not new engine. A **person-SIM** (1 persona) reacts *as that one person*; keep the **existing Socials debounce/throttle** so cost stays bounded. Creator behavior byte-identical. **Rejected:** Socials-only live + General-on-submit (breaks the live moat-touch on the most important place to feel it — under-delivers UX-03); deferring reactor generalization (UX-03 is in-scope — would drop a requirement).

### Scope (the cut line)
- **D-05: Intent → success-criterion composer chip is DEFERRED (out of P7).** The `⊕grow`/`⊕reply-likely` chip (VISION §16.5 step 6, "fill in breadth") is **not** in UX-01..05. The success-criterion is **already authorable** on the P3 audience form, so the seam exists; a composer chip would duplicate that AND touch the byte-identical creator composer for no P7 payoff. Leave the seam, build nothing. Also OUT: any Discover/Apify corpus surface; the SIM marketplace; multi-stimulus/batch; `.docx`/`.pdf` ingest (all already deferred upstream).

### Claude's Discretion (planner/researcher decide — do NOT re-ask the founder)
- **The `modes[]` tag shape** on the `SKILLS` array (string union vs enum) + exactly how `composer-controls.tsx` `SkillRows` filters by `selectedAudience.mode` (and what the default is when no audience is selected → Socials default, §16.2). The lock is D-01: tag-driven, reads the active mode, removes the hardcoded creator/marketing split.
- **The dropdown/popover primitive** for the picker (reuse the existing audience-manager card component vs a compact list row) + the exact anchor in the composer left cluster + how `+ Build an audience` is rendered in-menu. The lock is D-02: in-composer, reuses audience-manager rows, sectioned by mode, no surface hop.
- **The Build chooser UI** (modal vs inline step) + auto-naming of the built SIM (derive from description/evidence/template, editable) + the clone mechanics for template→owned-SIM via `audience-repo` CRUD. The lock is D-03: one entry, three paths, all save a named General SIM, template=clone-and-edit, evidence reuses `profile-runner`.
- **The pre-seeded sample chat content** + the show-once persistence mechanism (localStorage flag vs a profile field) + dismiss affordance. The lock is D-04: one-tap, runs Profile→Read, show-once.
- **The reactor rename/wiring** (`audience` → "the active Audience") + the person-SIM single-reactor framing in the ambient surface + reuse of the existing throttle. The lock is D-06: live for General, reuse mechanism, bounded cost.
- **Cross-mode thread behavior** when a user switches Audience mode mid-thread (continue vs fresh context) — planner's call; default to the existing thread behavior, do not special-case unless it breaks.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision, roadmap & requirements (the front-door SSOT)
- `.planning/NUMEN-GSI-VISION.md` — **§15 (Product surface + PMF)** and **§16 (Object model + user logic)** are the LOCKED design for this entire phase: §15.1 (promote the lens, no new pills), §15.2 (everything = "audience" → "the active Audience"; creator byte-identical table), §15.3 (two views, one composer — the composer mockups), §15.4 (PMF: protect creator core + one general wow), §15.5 (home empty state + chip copy + first-run demo = profile-chat), §16.1 (the picker structure — Mode as section header, `+ Build an audience`), §16.2 (run resolution + zero-setup defaults), §16.3 (the three flows A/B/C), §16.4 (the key asymmetry: Simulate/Predict pick Audience first, Profile = Audience is the output), **§16.5 (UI build order — steps 1–3+6 are P7; step 6 intent→success-criterion is DEFERRED per D-05)**. Walk §15–16 fully; this is the most important ref for P7.
- `.planning/ROADMAP.md` §"Phase 7: Audience-as-Front-Door Surface" — goal + the 5 success criteria.
- `.planning/REQUIREMENTS.md` — **UX-01, UX-02, UX-03, UX-04, UX-05** (the requirements this phase closes).

### Prior-phase context (carry-forward — P7 promotes what P3/P5/P6 built)
- `.planning/phases/03-general-population-honesty-layer/03-CONTEXT.md` — the General audience + `mode` field + `groupAudiences` + the General library + `GENERAL_TEMPLATES` (analyst/hiring) + `resolveTier` (Directional-by-rule) + `success_criterion`/`custom_context`. P7's picker sections, defaults, and Build/template path all stand on this.
- `.planning/phases/05-profile-simulate-wow/05-CONTEXT.md` — D-07 (the existing thread + blocks renderer + forward-chain handoff + the minimal composer affordance P7 now promotes); `profile-runner`/profile-drop = the **from-evidence** Build path P7 reuses (D-03); the reaction-distribution wow the front door surfaces.
- `.planning/phases/06-predict-verb/06-CONTEXT.md` — Predict = the third General skill the menu exposes (D-01); the chain-CTA pattern; the locked "front-door stays P7" carry-forward this phase finally discharges.

### Surface files P7 touches (from the P7 readiness survey — paths + line refs)
- `src/components/app/home/composer-controls.tsx` — **UX-02 target.** `SKILLS` array L61–71 hardcodes `group: 'creator'|'marketing'` (L43); rendering L210–211/L272–280 filters by group, never by `audience.mode`. D-01 adds the `modes[]` tag + mode filter here.
- `src/components/app/home/composer.tsx` — **UX-01 target.** Tracks audience state (`audiences`, `selectedAudienceId`, `selectedAudience`) ~L204–232; the `AudienceChip` is wired but **retired** ~L103–104. D-02 re-promotes it.
- `src/components/app/home/audience-chip.tsx` — the retired chip (L1–286) to promote into the front-door dropdown (D-02).
- `src/components/audience/audience-display.ts` — `groupAudiences()` L126–146 already buckets `mode==='general'` into `generalTemplates` (L140). The picker's Socials/General sections reuse this.
- `src/lib/audience/audience-types.ts` — `Audience` + `mode` (required, L218) + `CalibratedPersona` + the `__subject_kind` custom_context marker convention.
- `src/components/audience-lens/audience-presence.tsx` — **UX-03 target.** Takes `audience: Audience | null` (L68); already projects per-audience reactions. D-06 generalizes its wiring.
- `src/components/audience-lens/ambient-presence-types.ts` — `AmbientPresenceProps` (L50–55) — the reactor's prop contract.
- `src/lib/engine/flash/build-reaction-panel.ts` — `buildAudienceRepaint(audience)` (L68–99) — the SINGLE pack-driven source of truth projecting an audience → archetype→repaint map; already mode-agnostic (the seam D-06 builds on).
- `src/components/audience-lens/flat-card-reactions.ts` — `cardScrollQuoteReactions()` (L57–94) — generic reaction parse, no hardcoded socials vocabulary.
- `src/app/(app)/audience/new/page.tsx` + `src/components/audience/audience-form.tsx` (L1–150) + the `CalibrationFlow` it orchestrates — **UX-04 target.** The from-description build path + the calibration infra all three Build paths reuse (D-03).
- `src/lib/audience/audience-repo.ts` — CRUD + the General library + `GENERAL_TEMPLATES` / `SENTINEL_IDS` (`template-analyst` ~L117–168, `template-hiring`). The template clone-and-edit (D-03) and the zero-setup General default (§16.2) live here.
- `src/app/(app)/home/page.tsx` — **UX-05 target.** Empty state explicitly LOCKED empty L13–19 (D-18/D-25, "demo is Phase 5"). P7 unlocks it (D-04).
- `src/components/app/home/home-greeting.tsx` (L1–63) + `src/components/app/home/home-page-layout.tsx` (L37–45) — the greeting + layout the chips + demo mount into (D-04).
- The **audience-manager** component(s) under `src/components/audience/` — the UI §16.5 step 1 says to reuse for the picker (D-02).
- `src/lib/tools/runners/profile-runner.ts` (P5) — the from-evidence Build path (D-03) routes here; do not duplicate.

### Honesty / tier (carried)
- `src/lib/audience/resolve-tier.ts` — `resolveTier` (Directional-by-rule for General) — the badge the picker/cards carry.

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`groupAudiences()`** (`audience-display.ts` L126–146) — already sections audiences by `mode` into a General bucket; the picker's Socials/General headers are a render of this, not new logic.
- **`AudienceChip`** (`audience-chip.tsx`) — the retired front-door control; D-02 promotes it rather than building a new picker.
- **audience-manager card rows** (`src/components/audience/`) — the UI §16.5 step 1 / D-02 reuse for the dropdown rows.
- **`buildAudienceRepaint`** (`build-reaction-panel.ts`) — the pack-driven, mode-agnostic audience→repaint projection; the reactor (D-06) generalizes by wiring "the active Audience" through it (already works for General).
- **`profile-runner` + profile-drop** (P5) — the from-evidence Build path (D-03); reuse, do not rebuild.
- **`GENERAL_TEMPLATES` + `audience-repo` CRUD** (P3) — the template clone-and-edit source + the save target for all three Build paths (D-03); the zero-setup General default (§16.2).
- **`SKILLS` array + `SkillRows`** (`composer-controls.tsx`) — D-01 adds a `modes[]` tag + filter here; the smallest possible change to the one hardcoded site.

### Established Patterns
- **`mode` is first-class** — required on `Audience`, drives `groupAudiences`, read by the Predict route's panel guard. P7 extends the SAME field to drive the skill menu (D-01) and picker sections (D-02). No new state model.
- **Additive, wrap-don't-refactor** (P1–P6) — every P7 change is additive surface wiring; the Socials/creator path is untouched (byte-identical).
- **Directional-by-rule honesty** (`resolveTier`) — the picker + cards carry the badge; unchanged.
- **In-composer, no surface hop** — the wow is one continuous thread (P5/P6); the front door preserves that by living in the composer (D-02/D-04), not a separate page.

### Integration Points
- **Picker (D-02):** `composer.tsx` audience state → promoted `AudienceChip` dropdown → `groupAudiences()` sections + `+ Build an audience` → sets `selectedAudience` (carries `mode`) → drives the skill menu + reactor.
- **Skill menu (D-01):** `selectedAudience.mode` → `composer-controls.tsx` `SkillRows` filters `SKILLS` by `modes[]` tag → Socials shows creator skills, General shows Profile/Simulate/Predict.
- **Build (D-03):** `+ Build an audience` → chooser → {description→`audience-form`/calibration | evidence→`profile-runner` | template→`audience-repo` clone} → saved named General SIM in the library.
- **Empty state (D-04):** `home/page.tsx` → greeting + 3 chips + one-tap pre-seeded profile-chat example (show-once) → launches the P5 profile flow.
- **Reactor (D-06):** "the active Audience" → `audience-presence.tsx` → `buildAudienceRepaint` → live reaction (person-SIM = single reactor), existing throttle.

</code_context>

<specifics>
## Specific Ideas

- **The whole generalization is one concept-level rename** (§15.2): "audience" → "the active Audience." Creator experience byte-identical; generality lives *behind* the Audience picker. P7 is wiring + one new tag + one promoted control + one Build chooser + one empty-state — NOT new engine.
- **The picker is ONE selection, not two** (§16.1): each Audience carries its Mode, so picking an Audience sets the Mode (and the skill menu). The "Mode switch" is the section header, never a separate pill — this is the deliberate anti-bloat move.
- **The cold-start wow** (D-04): a brand-new user lands → one tap on a pre-seeded chat → sees a forensic Profile→Read → *that's* the §15.5 "most visceral horizontal moment first," with no chat-export friction.
- **Door-open discipline** (D-01): the founder is building the creator+brand vertical while keeping the horizontal door open. The `modes[]` tag is the concrete expression — domain lives in the Audience/pack/tag, never hardcoded in the surface. The ONE hardcoded-socials site (the skill menu) is exactly what P7 removes.
- **Founder wants decisive, grounded recommendations** — all 6 P7 gray areas resolved by accepting the recommended option (matches P3/P4/P5/P6; 6/6 this phase). The founder explicitly asked for recommendations baked into the choices.

</specifics>

<deferred>
## Deferred Ideas

- **Intent → success-criterion composer chip** (the `⊕grow`/`⊕reply-likely` affordance, VISION §16.5 step 6) → later breadth (D-05). The seam exists (audience carries `success_criterion`, authorable on the P3 form); P7 builds no composer chip.
- **Discover / Apify corpus surface** (scrape-fed outlier browser, the "Sandcastles-style" pages) → future milestone, as a **pack capability the active SIM lights up**, never a top-level page. Out of P7 entirely (G2 from the strategy discussion).
- **Brand vertical as a distinct surface tree** → arrives later as a **customer-SIM + sell-intent**, not new pages; P7 leaves the picker/intent seam open for it (G1).
- **SIM marketplace + rev-share flywheel** (MKT-*), **self-calibration Directional→Validated** (CAL-01), **Anchor Pack #2** (PACK2-01) → v2 (tracked, not in this roadmap).
- **Multi-stimulus / batch**, **`.docx`/`.pdf` ingest** → already deferred upstream (P4/P5); unchanged.
- **Cross-mode mid-thread behavior** as an explicit feature → planner default to existing thread behavior; only design if it breaks.

### Reviewed Todos (not folded)
- **`p05-code-review-followups.md`** — P5 route/composer hardening (WR-01 file-cap bypass, WR-04 composer video no-op, Info items). Already reviewed in P6 (WR-03 folded there); the rest stay a **P5 hardening pass**, not P7 surface scope.
- **`simulate-reaction-person-framing.md`** — the P5 "barbell" content-frame finding. Already informed P6's D-02 (new predict reasoning frame); the Simulate-side content-frame fix stays an **engine/P5 follow-up**, not P7 scope.

</deferred>

---

*Phase: 7-audience-as-front-door-surface*
*Context gathered: 2026-06-29*
