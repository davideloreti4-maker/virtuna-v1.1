# UI Design Track — Surfaces Plan

> Worktree `virtuna-numen-ui` · branch `design/ui-system` · tool: Cursor.
> Parallel to the engine rework (`virtuna-engine-rework`). Design rules: `.cursor/rules/ui-design.mdc`.
> Design SoT: `docs/DESIGN-SYSTEM.md` + `src/app/globals.css` (ignore all other design docs — stale).

## Coupling status (decides what's safe to build now)

Surfaces split into **free-to-build** (no engine dependency — go now) and **gated**
(coupled to the in-flight engine rework — restyle OK, but structural/data changes wait).

| Surface | Components | Status | Notes |
|---|---|---|---|
| **Audience creation flow** | `src/components/audience/` (`audience-form`, `calibration-flow`, `persona-edit-form`, `audience-manager`); routes `src/app/(app)/audience/*` | 🟡 GATED | audience data model is the FIRST engine rework (3-position model). Restyle freely; hold changes to what fields/personas the form captures until model settles. |
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
