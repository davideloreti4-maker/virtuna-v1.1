# Phase 54: Card & Surface Corrections - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Cards, header/navbar, and input components render with Raycast-accurate backgrounds, borders, shadows, and hover states. This phase corrects visual tokens and component styles to match Raycast.com extraction exactly. No new components or capabilities — only fixing existing ones to match the reference.

</domain>

<decisions>
## Implementation Decisions

### Card hover interaction
- Unified hover for ALL card variants (Card, GlassCard, FeatureCard) — same lift, border, bg overlay
- Hover transition: snappy 150ms timing
- Hover = match Raycast exactly: -translate-y-0.5, border→white/10, bg overlay
- Interactive vs display-only cards: match whatever Raycast does (no custom distinction)

### Gradient vs transparency approach
- Cards switch from backdrop-filter blur to solid 137deg gradient — match Raycast exactly
- Whether GlassCard merges into Card or stays separate: Claude's discretion based on codebase usage
- backdrop-filter fully removed from cards if Raycast doesn't use it on cards
- FeatureCard adopts standard 6%/10% borders, matches Raycast extension card treatment
- Card background token usage (gradient-card vs bg-transparent): match Raycast's pattern per context

### Input unification
- Remove GlassInput — base Input adopts Raycast styling (white/5 bg, 5% border, 42px height)
- Remove GlassTextarea — consolidate into single Textarea with Raycast styling
- All input heights (Input, Select, Textarea min-height): match Raycast per input type
- Focus ring/border: match Raycast input focus behavior exactly
- After consolidation: one Input, one Textarea, one Select — no Glass* input variants

### Header glass treatment
- Header gets Raycast glass pattern (137deg gradient + blur(5px) + 6% border)
- Sticky/static behavior: match Raycast.com navbar
- Bottom border: match Raycast navbar treatment
- Mobile menu: match Raycast's mobile nav approach
- Header dimensions (height, padding, logo size, nav spacing): match Raycast exactly

### Claude's Discretion
- White/3 hover overlay implementation (pseudo-element vs direct bg change)
- Whether GlassCard merges into Card or stays as semantic alias
- Exact transition easing curves

</decisions>

<specifics>
## Specific Ideas

- Overarching principle from user: "Match Raycast on everything" — do not second-guess, replicate what Raycast does
- Phase research should verify all decisions against live Raycast.com CSS before implementation
- Researcher should extract exact Raycast CSS for: card hover states, navbar sticky behavior, input focus states, mobile nav treatment
- Any ambiguity resolves to "what does Raycast do?"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-card-surface-corrections*
*Context gathered: 2026-02-06*
