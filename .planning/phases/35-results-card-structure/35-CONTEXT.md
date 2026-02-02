# Phase 35: Results Card Structure & Scoring - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Design the viral predictor results card — the breakdown/analysis shown to users after running a prediction. This is the "wow moment" that needs to be screenshot-worthy and shareable in video content. Same format will be reused in Trending Page's "Analyze" action.

</domain>

<decisions>
## Implementation Decisions

### Breakdown Structure
- **Layered system**: Verdict → Breakdown → Actionable → Deep dive (expandable)
- **5+ tier labels** for viral potential ("Viral Ready", "High Potential", etc.)
- **Many sections acceptable** if layered well with premium visuals — no data overload per section
- Reference: app.societies.io results page for information density approach

### Scoring Approach
- **Hero score: /100** — big, prominent number at top (like societies.io)
- **Individual factors: numerical (1-10 or %)** — data-driven feel at detail level
- **Confidence levels shown** — transparency builds trust ("High confidence" / "Based on limited data")
- **Hybrid calculation display** — show key factors that influenced verdict, not exact weights

### Visual Layout
- **Style: Glass/depth + data dashboard animations** — sophisticated glassmorphism with animated data visuals
- **Hero: Number + ring combo** — score in center of animated circular gauge
- **Ring animation: Gradient fill that shifts** — color journey from red → yellow → green as ring fills (1.5-2s timing)
- **Factor layout: Vertical list** — full-width stacked cards, easy to scan
- **Color coding: Green → Red gradient** — universally understood for good/bad
- **Expansion: Accordion expand** — tap factor card, it expands inline with more details
- **Mobile: Same layout, responsive** — consistent experience, cards stack naturally
- **Glass intensity: Medium** — noticeable depth, premium without overpowering content
- **Animation suite: Full** — numbers count up + progress bars fill + staggered reveal timing

### Actionability
- **Primary CTA: Remix this content** — "Create your version" flows into Virtuna's remix feature
- **CTA placement: Sticky bottom button** — always visible, impossible to miss
- **Remix context: User selects** — checkboxes on factors, user picks what to carry into remix
- **Secondary actions: Minimal** — Remix is the focus, no distractions, other features live elsewhere

### Claude's Discretion
- Exact factor categories and their names (Hook Strength, Emotional Triggers, etc.)
- Spacing and typography details
- Glassmorphism blur/opacity exact values
- Stagger timing between factor cards
- Score tier thresholds (what scores = "High Potential" vs "Moderate")

</decisions>

<specifics>
## Specific Ideas

- **This is the wow moment** — needs to be screenshot-worthy, something that makes people stop scrolling when they see it in a video online
- **Reference: app.societies.io** — score view style with /100, information density approach
- The ring filling while color shifts creates anticipation: "where will this land?"
- Factors should feel like insider knowledge, not just metrics anyone can see

</specifics>

<deferred>
## Deferred Ideas

- Save to library — separate feature
- Share analysis link — separate feature
- Compare against other analyses — separate feature
- These can be added to results card later as secondary actions if needed

</deferred>

---

*Phase: 35-results-card-structure*
*Context gathered: 2026-02-02*
