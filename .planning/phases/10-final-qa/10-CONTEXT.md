# Phase 10: Final QA - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual verification and polish — side-by-side comparison with societies.io, fixing discrepancies, performance optimization, and responsive testing. This is a pixel-perfect clone project where accuracy to the reference is paramount.

</domain>

<decisions>
## Implementation Decisions

### Comparison Methodology
- Use most accurate approach available, including v0 MCP, browser tools, and reference screenshots
- App dashboard is highest priority, then landing page
- Compare ALL interactive states: default, hover, active, focus, loading, empty, error
- Match animation timing and easing exactly (not just "animations work")
- Match exact font metrics: font-size, line-height, letter-spacing precisely
- Match exact icons from the same icon library as societies.io
- Match structure for dynamic/user-specific content (mock data can differ)
- Match scrolling behavior: smooth scroll, sticky headers, scroll-triggered animations
- Prioritize accuracy and quality over efficiency

### Discrepancy Tolerance
- Pixel-perfect standard — any visible difference is a bug to fix
- Fix regardless of effort — even if significant refactoring required
- **Intentional deviations to preserve:**
  - Content differences (e.g., test history has different text)
  - Custom screens societies.io doesn't have (e.g., settings page)
- Custom screens must match societies.io design language (same patterns, colors, spacing)

### Performance Targets
- No hard Lighthouse score targets
- Fast initial load AND smooth interactions both matter equally
- Optimize images only if obvious issues (clearly oversized files)
- Zero console errors required (warnings acceptable)
- 60fps for all animations and transitions

### Responsive Breakpoints
- Test: Mobile (375px) and Desktop (1440px)
- societies.io doesn't have mobile view — create responsive mobile-optimized adaptation
- Mobile must be fully functional (all features work, layout adapts properly)
- Test touch interactions: tap targets, swipe gestures, touch feedback

### Claude's Discretion
- Documentation approach for tracking discrepancies
- Chrome as reference browser (other browsers should be close)
- Specific tools and methodology for comparison (v0 MCP, overlays, etc.)

</decisions>

<specifics>
## Specific Ideas

- "Use best practice for most accurate pixel-perfect result"
- "Utilize tools like v0 MCP, browsers, references — whatever needed"
- "Design UI clone 1:1" — this is the core mandate
- societies.io is the reference for desktop; mobile is Virtuna's own responsive adaptation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-final-qa*
*Context gathered: 2026-01-29*
