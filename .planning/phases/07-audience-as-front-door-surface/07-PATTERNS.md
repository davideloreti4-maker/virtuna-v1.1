# Phase 7: Audience-as-Front-Door Surface - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 9 (8 modified existing + 1 new)
**Analogs found:** 9 / 9 (every primitive already lives in-repo — this is a wire-don't-build phase)

> All P7 work is ADDITIVE wrapping of existing surfaces. The closest analog for almost every
> new file IS the file being modified (it already contains the pattern to extend). Where a new
> file is created (Build chooser), the analog is the existing in-repo popover/dialog convention.
> The #1 governing constraint is the **byte-identical Socials render** — see the Byte-Identical
> guard rows in `07-UI-SPEC.md` `## Byte-Identical Contract`.

---

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|------|---------|------|-----------|----------------|---------------|
| `src/components/app/home/composer-controls.tsx` | modify | component (skill SSOT) | transform (render-time filter) | self (L61–71 `SKILLS`, L197–286 `SkillRows`) | exact (in-place extend) |
| `src/components/app/home/composer.tsx` | modify | component (composer host) | request-response (submit routing) | self (audience state L204–232, `handleSubmit`) | exact (in-place extend) |
| `src/components/audience-lens/audience-presence.tsx` | modify | component (picker + reactor) | event-driven (select + live react) | self (switcher L307–359) | exact (in-place extend) |
| `src/app/(app)/home/page.tsx` | modify | route (server page) | request-response | self (L13–25 LOCKED-empty doc) | exact (unlock) |
| `src/components/app/home/home-page-layout.tsx` | modify | component (layout) | render | self (L34–55) | exact (additive block) |
| `src/components/app/home/build-chooser.tsx` | **new** | component (modal chooser) | event-driven → CRUD | `audience-presence.tsx` switcher popover + Radix `Dialog` | role-match |
| `src/lib/audience/audience-repo.ts` | modify | service (CRUD) | CRUD | self (`createAudience` L445, `GENERAL_TEMPLATES` L117) | exact (thin clone helper) |
| Test: `composer-controls.test.tsx` | modify | test | — | self (asserts Creator/Marketing today) | exact (update) |
| Test: `home.test.tsx` | modify | test | — | self (asserts NO chips/demo today) | exact (update) |
| Test: `audience-presence.test.tsx` | modify | test | — | self (existing) | exact (extend) |

---

## Pattern Assignments

### `composer-controls.tsx` (component, transform) — UX-02 / D-01 / D-07

**Analog:** self — the `SKILLS` SSOT + `SkillRows` filter already exist; add a `modes[]` tag + thread `activeMode`.

**SkillMeta + SKILLS pattern to extend** (L43–71):
```typescript
export type SkillGroup = "creator" | "marketing";
// ADD: export type SkillMode = "socials" | "general";
export interface SkillMeta {
  id: ToolId;
  label: string;
  desc: string;
  command: string;
  group: SkillGroup;
  // ADD: modes: SkillMode[];   // e.g. ["socials"] for Hooks/Test/…; ["general"] for Profile/Simulate/Predict
  model: SkillModel;
  enabled: boolean;
}
export const SKILLS: SkillMeta[] = [
  { id: "explore", label: "Explore", ... group: "creator", model: "Flash", enabled: true },
  // ADD modes: ["socials"] to every existing entry; ADD 3 new general entries (profile/simulate/predict)
];
```
**Note:** `ToolId` union (L32–41) is `test|idea|hooks|chat|script|remix|explore|offer|ad` — it does NOT contain profile/simulate/predict. D-07 requires adding those three ids + per-skill submit semantics (see Pitfall 1 below — this is the central planning risk).

**The filter site to change** (L208–211, CURRENT):
```typescript
const match = (s: SkillMeta) =>
  !q || s.label.toLowerCase().includes(q) || s.command.includes(q);
const creator = SKILLS.filter((s) => s.group === "creator" && match(s));
const marketing = SKILLS.filter((s) => s.group === "marketing" && match(s));
```
**Target:** gate the whole list on the active mode FIRST, then partition by `group` for the Socials sub-headers:
```typescript
const inMode = (s: SkillMeta) => s.modes.includes(activeMode ?? "socials");
const creator   = SKILLS.filter((s) => inMode(s) && s.group === "creator"   && match(s));
const marketing = SKILLS.filter((s) => inMode(s) && s.group === "marketing" && match(s));
```
`SkillRows` props (L198–206) currently receive NO mode — add `activeMode` prop; `ComposerControls` (props ~L324–347) must thread it from `composer.tsx`. Default `"socials"` (§16.2, byte-identical guard).

**Row visual language (reuse verbatim for the 3 general rows)** (L213–264): same 8px-radius hover-lift `hover:bg-[#2b2926]`, `text-foreground`, MAX badge convention, `Ico name={SKILL_ICON[s.id]}`. **NO accent on pills** (dosage rule). Add icon keys for profile/simulate/predict to `SKILL_ICON` (L112) from the existing `ICONS` set (e.g. `people`/`target`/`crosshair` already defined L88–99).

---

### `audience-presence.tsx` (component, event-driven) — UX-01 / D-02 + UX-03 / D-06

**Analog:** self — the LIVE switcher popover at L307–359 IS the picker. Do NOT resurrect `audience-chip.tsx` (dead code, doubles the picker; markup reference only).

**Current flat-map row list to section** (L320–347):
```typescript
{audiences.map((a) => {
  const on = a.is_general ? isGeneral : a.id === selectedAudienceId;
  const sub = a.is_general ? 'Default — keeps the regression gate'
            : `${a.platform}${a.goal_label ? ` · ${a.goal_label}` : ''}`;
  return (
    <button role="menuitemradio" aria-checked={on}
      onClick={(e) => { e.stopPropagation(); handleSelect(a); }}
      className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left ... hover:bg-[var(--color-hover)]">
      <Users className="h-4 w-4 ... text-[var(--color-foreground-secondary)]" />
      <span><span className="block text-[13px] font-medium text-[var(--color-foreground)]">{a.name}</span>
      <span className="... text-[11px] text-[var(--color-foreground-muted)]">{sub}</span></span>
      <Check className={... (on ? 'opacity-100' : 'opacity-0')} />
    </button>
  );
})}
```
**Target (D-02):** replace the flat `.map` with `groupAudiences(audiences)` sections + a `+ Build an audience` row:
```typescript
const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);
// ── Socials ── : baseline + templates + yours.filter(a => a.mode === "socials")
// ── General ── : generalTemplates + yours.filter(a => a.mode === "general")   // render ONLY if non-empty
```
**Section-header pattern already in-file** (L314–316) — reuse for the `── Socials ──` / `── General ──` dividers:
```typescript
<p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">{TITLE}</p>
```
**Footer pattern to repurpose into `+ Build an audience`** (L348–357) — the hairline + `<Link>` with `<Plus/>`:
```typescript
<div className="mx-1 my-1.5 h-px bg-[var(--color-border)]" />
<Link href="/audience" ...><Plus className="h-4 w-4" /><span className="flex-1">{MANAGE_LABEL}</span></Link>
```
Replace/augment with a `+ Build an audience` button that opens the S3 chooser (the description path still hops to `/audience/new` per D-08). NO accent on the row.

**Trust badge:** import the leaf `resolveTier` (`src/lib/audience/resolve-tier.ts`) — NEVER the pack barrel (BUILD-01 bundle-leak discipline). Render neutral muted text (`Directional`/`Validated`), right-aligned.

**Reactor (D-06):** the liveness dot already exists (L300–302, `bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]`) — this is the ONE sanctioned accent. The reactor view is already audience-agnostic; `buildAudienceRepaint` (see Shared Patterns) is mode-agnostic. Generalization = wiring + person-SIM single-reactor framing; **do NOT touch the `audienceRepaint === undefined` no-op branch** (byte-identical engine guard).

---

### `build-chooser.tsx` (NEW component, event-driven → CRUD) — UX-04 / D-03 / D-08

**Analog:** the `audience-presence.tsx` switcher popover (L308–359) for outside-click/Escape/upward-open + Radix `Dialog`. UI-SPEC S3 recommends a centered Radix `Dialog` (radius 12px, `--charcoal-composer` surface, 6% border, `--shadow-float`).

**Three full-width path rows** (reuse the L335 row markup: 8px radius, hover-lift, NO accent, plain cream labels):
1. `From a description` → HOP to `/audience/new` with `mode:'general'` preset (D-08).
2. `From evidence` → in-composer → P5 `profile-runner` / evidence-drop (reuse, do not rebuild — `src/lib/tools/runners/profile-runner.ts` L208–300 already saves `mode:'general'`).
3. `From a template` → list `GENERAL_TEMPLATES` (analyst/hiring) → clone-and-edit (see audience-repo pattern below).

---

### `audience-repo.ts` (service, CRUD) — UX-04 clone helper / D-03

**Analog:** self — `createAudience` (L445–475) is the single validated save target; `GENERAL_TEMPLATES` (L117–168+) is the clone source.

**`createAudience` contract (reuse verbatim — never pass client `user_id`)** (L445–474):
```typescript
export async function createAudience(supabase: SupabaseClient, input: Partial<Audience>): Promise<Audience> {
  const parsed = WritableAudienceSchema.safeParse(input);   // Zod: name≤80, success_criterion/note≤2000, custom_context≤50
  if (!parsed.success) throw new Error(...);
  const { data: { user } } = await supabase.auth.getUser();  // CR-01: user_id from session, NEVER input
  if (!user) throw new Error("unauthenticated");
  const rowPayload = audienceToRow(input, user.id);
  ... .from("audiences").insert(rowPayload).select("*").single();
}
```
**Template clone (D-03) — strip the sentinel id, preserve `mode:'general'`:**
```typescript
const tpl = GENERAL_TEMPLATES.find((t) => t.id === chosenTemplateId)!;   // id e.g. "template-analyst"
const { id, user_id, created_at, updated_at, ...cloneable } = tpl;        // drop SENTINEL_IDS + virtual fields
await createAudience(supabase, { ...cloneable, name: derivedEditableName }); // mode:'general' carried in cloneable
```
**Gotcha:** `GENERAL_TEMPLATES` rows carry `user_id: "__virtual__"` + `id: "template-analyst"` (L119–120) — both MUST be stripped. `WritableAudienceSchema` accepts `mode`/`success_criterion`/`custom_context`/`personas`/`persona_weights`/`signature`.

---

### `home/page.tsx` + `home-page-layout.tsx` (route + layout) — UX-05 / D-04

**Analog:** self — both are LOCKED-empty today; P7 unlocks the previously-empty block.

`page.tsx` L20–25 doc-comment explicitly states "NO starter chips (D-18), NO demo affordance (D-25)" — drop that lock. `home-page-layout.tsx` renders `<HomeGreeting/>` then `<Composer/>` in the `!hasConversation` block (L37–46) — the chips + show-once demo mount as an ADDITIVE block here, below the greeting (UI-SPEC S4: `xl`/32px above chip row, `lg`/24px block rhythm).

**Chips:** 3 LOCKED-verbatim chips (`Test an idea on your audience` / `Profile a chat` / `Predict an outcome`), `#2f2e2b` lifted surface, 8px radius, 6% border (10% hover), NO accent.
**Demo:** one-tap `See it in action` (neutral cream `--color-action`) → `POST /api/tools/profile` with a canned fixture; `Dismiss` muted text link.
**Show-once:** `localStorage` flag (precedent: `use-lens-scale.ts`, `society-selector.tsx`). Set on first run OR dismiss.

---

## Shared Patterns

### Audience sectioning by mode
**Source:** `src/components/audience/audience-display.ts` L126–146 `groupAudiences()`
**Apply to:** picker switcher (D-02), Build chooser.
```typescript
export function groupAudiences(audiences: Audience[]): { baseline; templates; generalTemplates; yours } {
  for (const a of audiences) {
    if (a.mode === "general") generalTemplates.push(a);   // routes FIRST (A6/Pitfall 5)
    else if (a.is_general) baseline.push(a);              // GENERAL_AUDIENCE is mode:'socials' → baseline
    else if (a.is_preset) templates.push(a);
    else yours.push(a);
  }
}
```
**Do NOT re-derive sectioning** — `mode==='general'` is checked before `is_general` precisely so the baseline stays in Socials (Pitfall 5).

### Mode-agnostic reactor (byte-identical no-op guard)
**Source:** `src/lib/engine/flash/build-reaction-panel.ts` L68–99 `buildAudienceRepaint(audience)`
**Apply to:** reactor generalization (D-06).
Returns `undefined` for `is_general`/empty-personas → Flash path omits the arg → byte-identical no-op. Already mode-agnostic; generalizing is wiring. KEEP `audienceRepaint === undefined` branch untouched (locked by `audience-regression-gate.test.ts` ENGINE_VERSION `3.20.0`).

### Trust badge (honesty spine)
**Source:** `src/lib/audience/resolve-tier.ts` `resolveTier(audience)` — Directional-by-rule for General.
**Apply to:** picker rows, Build chooser rows. Import the LEAF helper, never the pack barrel (BUILD-01).

### Session-derived user_id (access control)
**Source:** `audience-repo.ts` L455–459 (CR-01) + RLS `audiences_all_own`.
**Apply to:** all 3 Build paths. Never accept `user_id`/`id` from the client; strip `SENTINEL_IDS` on clone.

### localStorage show-once
**Source:** `use-lens-scale.ts`, `society-selector.tsx`, `anti-virality-header.tsx` (in-repo precedent).
**Apply to:** D-04 first-run demo.

---

## No Analog Found

None. Every requirement maps to an existing in-repo seam. The single genuinely-new file (`build-chooser.tsx`) composes existing patterns (Radix Dialog + the switcher row markup + `createAudience`). If a plan proposes a new API route or engine call, it has drifted from the additive-wrap mandate (RESEARCH "Tier sanity note").

---

## Critical Cross-Cutting Risks (from RESEARCH — planner must honor)

1. **Pitfall 1 (HIGHEST):** Profile/Simulate/Predict are NOT in `SKILLS`/`ToolId` and `handleSubmit` has no branch for them. Each needs explicit per-skill submit semantics: **Profile** → opens evidence-drop (NOT a topic submit, composer.tsx ~L1596); **Simulate** → needs a selected General audience → `POST /api/tools/simulate` with `audienceId = selectedAudience.id`; **Predict** → needs panel + scenario → `POST /api/tools/predict`. Gate Simulate/Predict on a selected General audience (§16.4 asymmetry). Do NOT route them through the generic topic `handleSubmit`.
2. **Pitfall 2:** byte-identical Socials path — default `activeMode='socials'`; no `── General ──` header when none owned; reactor no-op branch untouched.
3. **Pitfall 3:** three tests encode obsolete assumptions and WILL fail — UPDATE (don't weaken): `composer-controls.test.tsx` (Creator/Marketing → mode-scoped), `home.test.tsx` (NO-chips/demo → 3 chips + demo + show-once), `audience-presence.test.tsx` (extend for sections + Build row).
4. **Test runner:** `node ./node_modules/vitest/vitest.mjs run <path>` — `npm test`/`npx vitest` print fake PASS(0). Real authed browser pass of `/home` required (Next bundle-leak class vitest can't catch).

---

## Metadata

**Analog search scope:** `src/components/app/home/`, `src/components/audience-lens/`, `src/components/audience/`, `src/lib/audience/`, `src/lib/tools/runners/`, `src/lib/engine/flash/`, `src/app/(app)/home/`
**Files read this pass:** composer-controls.tsx (L1–286), audience-display.ts (L110–159), audience-presence.tsx (L300–369), audience-repo.ts (L110–168, L440–475), home/page.tsx (full), home-page-layout.tsx (full)
**Pattern extraction date:** 2026-06-29
</content>
</invoke>
