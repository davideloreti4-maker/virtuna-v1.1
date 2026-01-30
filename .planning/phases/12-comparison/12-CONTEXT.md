# Phase 12: Comparison - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Document every visual discrepancy between Virtuna and app.societies.io using v0 MCP-powered analysis. Produce a comprehensive discrepancy report that guides Phase 13 refinement work. No code changes in this phase — analysis and documentation only.

</domain>

<decisions>
## Implementation Decisions

### Comparison Workflow
- Organize comparisons by screen (dashboard, settings, modals as units)
- Use v0 MCP with both approaches: full screenshot pairs for overview, cropped regions for detail when needed
- Process screens sequentially, one at a time
- Missing/extra elements flagged as critical (structural mismatch)
- Desktop only — mobile shows "expand window" message, app not mobile-friendly
- Primary reference: `extraction/screenshots/desktop-fullpage/` (14 complete captures)
- Capture Virtuna screenshots using same Playwright scripts against localhost:3000

### Discrepancy Documentation
- Record discrepancies in structured tables: `| ID | Component | Issue | Type | Severity | Fix Hint | File Path | Status |`
- Include pixel-level measurements when possible ("padding is 16px, should be 24px")
- Extract findings only — no raw v0 analysis preserved
- Include suggested CSS fixes with specific values
- Each screen section includes image path references: `![ref](path/to/ref.png)`
- Link to specific code files when known: `src/components/Sidebar.tsx:42`
- Track issue status (Open/Fixed) — updated during Phase 13
- Global IDs for easy commit reference: D-001, D-002... ("fix(visual): resolve D-042")

### Prioritization Criteria
- **Critical:** Layout breaks (misaligned, overlapping, wrong position) + missing/extra elements
- **Major:** All of the following are major:
  - Color discrepancies (any mismatch)
  - Spacing discrepancies (any mismatch)
  - Typography discrepancies (font, weight, size)
  - Animation/transition differences (timing, easing, duration)
  - Clearly visible differences + functional impact issues
- **Minor:** Subtle differences (1-2px) on non-primary/decorative elements only
- No skip category — document everything for 98% accuracy goal

### Claude's Discretion
- Whether to batch similar screens in one v0 call or analyze individually (based on complexity)
- Output structure: single consolidated report vs per-screen files (will use best practice)
- Virtuna screenshot folder organization (will use best practice)

</decisions>

<specifics>
## Specific Ideas

- Discrepancy IDs enable clean commit messages: "fix(visual): resolve D-042 sidebar padding"
- Summary statistics at top of report for quick overview (Total: X | Critical: Y | Major: Z | Minor: W)
- Report lives in `.planning/phases/12-comparison/`
- High bar for accuracy: colors, spacing, typography, animations all treated as major

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-comparison*
*Context gathered: 2026-01-30*
