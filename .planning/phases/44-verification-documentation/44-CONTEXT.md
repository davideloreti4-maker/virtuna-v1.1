# Phase 44: Verification & Documentation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify the design system's visual accuracy against Raycast, audit color contrast for WCAG AA compliance, and document the complete token + component system. This phase produces reports and documentation — it does NOT fix discrepancies or accessibility failures found during verification.

</domain>

<decisions>
## Implementation Decisions

### Visual comparison method
- Use screenshots, code inspection, and live side-by-side comparison
- Automated Playwright screenshots of both sites, generating comparison images per component area
- Target: exact pixel match (colors, spacing, typography, shadows) except where coral branding intentionally differs
- Comparison scope: full site — marketing pages AND /showcase against corresponding Raycast pages
- Discrepancies are documented only, not fixed in this phase — fixes become a separate phase/backlog item

### Documentation structure
- Documentation lives in both places: markdown files in repo (docs/) AND enhanced /showcase pages as living docs
- Component API doc depth: Claude's discretion based on component complexity
- Token reference: values table in markdown, with /showcase tokens page serving as the visual reference
- Include a contribution guide: naming conventions, file patterns, and how to extend the system

### Accessibility audit scope
- Target: WCAG AA (4.5:1 normal text, 3:1 large text)
- Scope: color contrast only — no keyboard nav, screen reader, or focus management audit
- Color scope: Claude's discretion on whether to focus coral scale or test all combinations
- Contrast failures are documented only, not fixed — consistent with visual comparison approach

### Brand Bible content
- Full brand guide: tokens, components, do's/don'ts, voice & tone, spacing philosophy, when to use what
- File structure: Claude's discretion (single BRAND-BIBLE.md vs multi-file docs/brand/)
- Raycast relationship: acknowledged in internal repo docs only, not in any user-facing content
- Color usage guidance (coral vs neutral): Claude's discretion on format

### Claude's Discretion
- Component API documentation depth per component
- Token reference color scope (coral focus vs all combinations)
- Brand Bible file structure (single file vs multi-file)
- Color usage guidance format (rules vs examples)

</decisions>

<specifics>
## Specific Ideas

- Full site comparison: not just showcase components but marketing pages against their Raycast equivalents
- Document-only approach across the board: this phase produces reports and references, not fixes
- Contribution guide should help future devs extend the system following established patterns
- Brand Bible is internal-facing — Raycast inspiration acknowledged in repo docs but not public

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-verification-documentation*
*Context gathered: 2026-02-05*
