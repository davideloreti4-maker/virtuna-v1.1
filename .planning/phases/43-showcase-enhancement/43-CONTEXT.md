# Phase 43: Showcase Enhancement - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build comprehensive showcase pages demonstrating all design system components, variants, states, and tokens. Replaces the existing /ui-showcase page. This is a presentation/documentation phase — no new components or tokens are created.

</domain>

<decisions>
## Implementation Decisions

### Page structure & navigation
- Claude's discretion on single page vs multi-page structure (decide based on component count and usability)
- Claude's discretion on navigation pattern (sidebar vs tabs — pick what works best for the component library size)
- Claude's discretion on whether showcase uses the marketing layout or a standalone layout
- Existing /ui-showcase page is **replaced** by the new showcase — one source of truth, no duplicate pages

### Component demo format
- Claude's discretion on interactivity level (static variant grid vs interactive playground)
- Claude's discretion on section pattern consistency (strict vs flexible per component)
- Claude's discretion on variant exhaustiveness (every combination vs curated highlights per component)
- Components shown on **dark background only** — matches the dark-mode-first design system, no light mode comparison

### Code snippets
- **Full examples per variant** — each variant/state gets its own code snippet showing exact props used (not just a single basic usage example)
- Claude's discretion on copy-to-clipboard functionality
- Claude's discretion on syntax highlighting approach
- Claude's discretion on whether to include props API tables alongside usage code

### Token visualization
- Claude's discretion on color display format (swatch grid, contextual, or both)
- Claude's discretion on whether to show two-tier architecture (primitive → semantic) mapping
- Claude's discretion on which token types get visual representation vs plain listing
- **Present as Virtuna's own system** — no Raycast attribution or references in the showcase

### Claude's Discretion
- Page structure decision (single page vs category pages)
- Navigation pattern (sidebar vs tabs vs other)
- Layout choice (marketing vs standalone)
- Interactivity level per component demo
- Section pattern consistency
- Variant display exhaustiveness
- Copy-to-clipboard implementation
- Syntax highlighting approach
- Props table inclusion
- Token visualization formats
- Token tier display approach
- Which token types get visual vs list treatment

</decisions>

<specifics>
## Specific Ideas

- User wants the showcase to replace /ui-showcase entirely — clean migration, no legacy page
- Dark backgrounds only for all demos — consistent with design system identity
- Code snippets should be thorough — one per variant/state, not just a basic example
- Virtuna-branded throughout — no mention of Raycast as source

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-showcase-enhancement*
*Context gathered: 2026-02-05*
