# UI Design Track — Surfaces Plan

> Worktree `virtuna-ui-restrained` · branch `design/ui-restrained` (off main) · tool: Cursor.
> Mission: the **restrained signal-red rebrand (de-Claude)** — dose down terracotta usages,
> switch primary actions to neutral cream, amplify the constellation motif. Token system + LOCKED
> dosage rule already landed; this is the per-surface application work.
> Parallel to the engine rework (`virtuna-engine-rework`, `rework/engine-core`). Design rules:
> `.cursor/rules/ui-design.mdc`. Design SoT: `docs/DESIGN-SYSTEM.md` + `src/app/globals.css`
> (ignore all other design docs — stale).

## ⛔ Engine-rework HOLD list (do NOT edit — guaranteed merge conflict)

`rework/engine-core` is **8 commits ahead of main, not yet merged**, and is actively rewriting
these UI-lane files. Editing them here WILL conflict — leave them until that branch merges:

- `src/components/audience/calibration-flow.tsx` (being modified)
- `src/components/audience/audience-reveal.tsx` (new file on the engine branch)

Everything else in `src/components/**` and all of `globals.css` is conflict-free (engine-rework
touches `src/lib/**`, `src/app/api/**`, `supabase/**`, `docs/subsystems/**`, types only). Rebase on
`origin/main` before starting and again before opening a PR to catch the merge when it lands.

## Coupling status (decides what's safe to build now)

Surfaces split into **free-to-build** (no engine dependency — go now) and **gated**
(coupled to the in-flight engine rework — restyle OK, but structural/data changes wait).

| Surface | Components | Status | Notes |
|---|---|---|---|
| **Audience creation flow** | `src/components/audience/` (`audience-form`, `calibration-flow`, `persona-edit-form`, `audience-manager`); routes `src/app/(app)/audience/*` | 🔴 HOLD (calibration-flow, audience-reveal) / 🟡 GATED (rest) | `calibration-flow.tsx` + `audience-reveal.tsx` are on the HOLD list above — do not touch. Rest: restyle freely; hold field/persona-shape changes until the 3-position model settles. |
| **Ambient audience / AudienceLens** | `src/components/audience-lens/` (`AudienceLens`, `audience-presence`, `PopulationSwarm`) | 🟡 GATED | the flagship ambient surface; its data contract changes with the audience rework. Visual/motion polish OK; don't change consumed props. |
| **Skills UI / thread cards** | `src/components/thread/` (`message-blocks` dispatcher + `*-card-block`) | 🟡 GATED | block schemas owned by engine track. Restyle card faces freely; don't change block shapes. |
| **Composer** | `src/components/app/home/composer.tsx` + `composer-controls.tsx` | 🟡 GATED | ambient-audience composer is coupled to audience + skills. Restyle OK. |
| **Library page** | route `src/app/(app)/library/page.tsx`; cards `src/components/saved/` | 🟢 FREE | mostly presentational; `saved-item-card.tsx:234,252` has stale `#FF7F50` to fix → tokens. |
| Design-system tokens / primitives | `globals.css`, shared primitives | 🟢 FREE | safe global polish; coordinate token renames. |
| Static / marketing / settings pages | `src/app/(app)/**` non-coupled routes | 🟢 FREE | no engine dependency. |

## Recommended order
1. **Start on 🟢 FREE work** — Library page, design-token polish, static pages, fix stray hardcoded hex. Zero conflict risk, immediate throughput.
2. **Restyle 🟡 GATED surfaces visually** (card faces, AudienceLens look, composer chrome) — safe as long as you don't touch data contracts/props/block schemas.
3. **Structural GATED work** (new audience-creation fields, new card types, ambient-audience interaction model) lands AFTER the matching engine subsystem reworks — sequence with the engine track.

## Per-surface doc
For each surface you take on, capture the before/after intent + decisions in
`docs/subsystems/ui-<surface>.md` (reuse the `docs/subsystems/_TEMPLATE.md` shape, UI-flavored)
so design decisions are recallable — mirrors how the engine track documents subsystems.
