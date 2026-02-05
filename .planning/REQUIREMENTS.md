# Requirements: Virtuna v2.0 — Design System Foundation

**Defined:** 2026-02-03
**Core Value:** Raycast-quality design system enabling rapid, consistent UI development with coral branding

## v2.0 Requirements

Requirements for design system foundation. Each maps to roadmap phases.

### Extraction (EXT)

- [ ] **EXT-01**: All Raycast color values extracted from raycast.com (backgrounds, text, accents, states)
- [ ] **EXT-02**: All Raycast typography values extracted (fonts, sizes, weights, line heights, letter spacing)
- [ ] **EXT-03**: All Raycast spacing values extracted (padding, margins, gaps)
- [ ] **EXT-04**: All Raycast shadow values extracted (elevation levels, glows)
- [ ] **EXT-05**: All Raycast border values extracted (radius scale, widths)
- [ ] **EXT-06**: All Raycast animation values extracted (durations, easing curves)
- [ ] **EXT-07**: All Raycast gradient definitions extracted
- [ ] **EXT-08**: Extraction covers all interactive states (hover, focus, active, disabled)
- [ ] **EXT-09**: Extraction documented with source references
- [ ] **EXT-10**: Extract from all key pages: homepage, pricing, about, extensions, API docs
- [ ] **EXT-11**: Exact font family identified (Inter vs custom) with fallback stack
- [ ] **EXT-12**: Responsive breakpoints extracted (mobile, tablet, desktop thresholds)
- [ ] **EXT-13**: Transition durations extracted per interaction type (hover, click, appear, exit)

### Tokens — Colors (COL)

- [ ] **COL-01**: Coral scale generated (100-900) with perceptually uniform progression
- [ ] **COL-02**: Coral accessibility verified — all text/background combinations pass WCAG AA (4.5:1)
- [ ] **COL-03**: Darkened coral variant created for text on light backgrounds
- [ ] **COL-04**: Primitive color tokens defined (raw values, not used directly)
- [ ] **COL-05**: Semantic color tokens defined (bg, fg, accent, error, warning, success, info)
- [ ] **COL-06**: Border color tokens defined
- [ ] **COL-07**: State color tokens defined (hover, active, disabled variants)
- [ ] **COL-08**: Color tokens match Raycast exactly (except coral replacing brand color)

### Tokens — Typography (TYP)

- [ ] **TYP-01**: Font family tokens defined (display, sans, mono)
- [ ] **TYP-02**: Font size scale defined (h1-h6, body, caption, small)
- [ ] **TYP-03**: Font weight tokens defined (regular, medium, semibold, bold)
- [ ] **TYP-04**: Line height tokens defined per size
- [ ] **TYP-05**: Letter spacing tokens defined per size
- [ ] **TYP-06**: Typography tokens match Raycast exactly

### Tokens — Spacing (SPC)

- [ ] **SPC-01**: Spacing scale defined (8px base, geometric progression)
- [ ] **SPC-02**: Component-specific spacing tokens defined (button-padding, card-padding, section-gap)
- [ ] **SPC-03**: Gap utilities for flex/grid layouts
- [ ] **SPC-04**: Spacing tokens match Raycast exactly

### Tokens — Shadows (SHD)

- [ ] **SHD-01**: Elevation shadow scale defined (sm, md, lg, xl)
- [ ] **SHD-02**: Glow effect tokens defined (for accent elements)
- [ ] **SHD-03**: Glass shadow tokens defined (for glassmorphism)
- [ ] **SHD-04**: Shadow tokens match Raycast exactly

### Tokens — Borders (BRD)

- [ ] **BRD-01**: Border radius scale defined (none, sm, md, lg, xl, full)
- [ ] **BRD-02**: Border width scale defined (0, 1, 2, 4)
- [ ] **BRD-03**: Border tokens match Raycast exactly

### Tokens — Animation (ANI)

- [ ] **ANI-01**: Duration tokens defined (fast, normal, slow)
- [ ] **ANI-02**: Easing tokens defined (ease-out, ease-in-out, spring)
- [ ] **ANI-03**: Z-index scale defined (base, dropdown, modal, toast)
- [ ] **ANI-04**: Animation tokens match Raycast exactly
- [ ] **ANI-05**: Transition duration per interaction type (hover: fast, appear: normal, exit: fast)

### Tokens — Breakpoints (BRK)

- [ ] **BRK-01**: Mobile breakpoint defined (max-width for phone)
- [ ] **BRK-02**: Tablet breakpoint defined (mid-range devices)
- [ ] **BRK-03**: Desktop breakpoint defined (standard screens)
- [ ] **BRK-04**: Wide breakpoint defined (large displays)
- [ ] **BRK-05**: Breakpoints match Raycast responsive behavior

### Tokens — Gradients (GRD)

- [ ] **GRD-01**: Coral gradient range defined (light -> primary -> dark)
- [ ] **GRD-02**: Card background gradients defined
- [ ] **GRD-03**: Overlay gradients defined
- [ ] **GRD-04**: Radial glow gradients defined

### Token Architecture (ARC)

- [ ] **ARC-01**: Two-tier token system implemented (primitive -> semantic)
- [ ] **ARC-02**: Tailwind @theme updated with all tokens
- [ ] **ARC-03**: CSS variables follow consistent naming convention
- [ ] **ARC-04**: Shared TypeScript types defined for design system
- [ ] **ARC-05**: Token documentation inline in globals.css

### Components — Core (CMP)

- [ ] **CMP-01**: Button component (primary, secondary, ghost, destructive variants)
- [ ] **CMP-02**: Button states (default, hover, active, disabled, loading)
- [ ] **CMP-03**: Button sizes (sm, md, lg)
- [ ] **CMP-04**: Card component (basic variant)
- [ ] **CMP-05**: GlassCard component (glassmorphism variant)
- [ ] **CMP-06**: Input component (text, password, search types)
- [ ] **CMP-07**: Input states (default, focus, error, disabled)
- [ ] **CMP-08**: Input with label, helper text, error message
- [ ] **CMP-09**: Badge component (semantic colors: default, success, warning, error, info)
- [ ] **CMP-10**: Badge sizes (sm, md)
- [ ] **CMP-11**: Typography components (Heading h1-h6, Text, Caption, Code)
- [ ] **CMP-12**: Icon system integration pattern
- [ ] **CMP-13**: Spinner/Loader component (sizes, determinate/indeterminate)

### Components — Extended (CMX)

- [ ] **CMX-01**: Select/Dropdown component
- [ ] **CMX-02**: Modal/Dialog component with glass styling
- [ ] **CMX-03**: Toast/Alert component
- [ ] **CMX-04**: Tabs component
- [ ] **CMX-05**: Avatar component (sizes, fallback, group)
- [ ] **CMX-06**: Divider component (horizontal, vertical, with label)

### Components — Raycast Patterns (RAY)

- [ ] **RAY-01**: Keyboard key visualization (key caps with proper styling)
- [ ] **RAY-02**: Shortcut badge component (Cmd+K style displays)
- [ ] **RAY-03**: Extension/feature card with gradient background
- [ ] **RAY-04**: Testimonial card pattern
- [ ] **RAY-05**: Category tab navigation pattern

### Components — Quality (CMQ)

- [ ] **CMQ-01**: All components have TypeScript interfaces exported
- [ ] **CMQ-02**: All components have JSDoc with @example blocks
- [ ] **CMQ-03**: All components use semantic tokens (never primitives)
- [ ] **CMQ-04**: All components have keyboard navigation
- [ ] **CMQ-05**: All components have accessible labels (aria-*)
- [ ] **CMQ-06**: All interactive elements meet 44x44px touch target minimum

### Effects — Glassmorphism (GLS)

- [x] **GLS-01**: GlassPanel base component with configurable blur (sm, md, lg)
- [x] **GLS-02**: Glassmorphism opacity configurable (0.1-0.3 range)
- [x] **GLS-03**: Glass border effect (semi-transparent white border)
- [x] **GLS-04**: Performance optimized (max 2-3 glass elements per viewport)
- [x] **GLS-05**: Mobile blur reduced (6-8px vs 12-20px desktop)
- [x] **GLS-06**: Noise texture overlay for tactile feel (subtle grain effect)
- [x] **GLS-07**: Chromatic aberration effect for premium glass (optional, configurable)

### Effects — Animation (EFX)

- [x] **EFX-01**: FadeIn animation component
- [x] **EFX-02**: SlideUp animation component
- [x] **EFX-03**: FadeInUp combined animation (Raycast signature)
- [x] **EFX-04**: Staggered reveal for lists/grids
- [x] **EFX-05**: Hover scale micro-interaction
- [x] **EFX-06**: Loading skeleton animation

### Showcase (SHW)

- [ ] **SHW-01**: /showcase main page with token visualization
- [ ] **SHW-02**: /showcase/inputs page (Input, Select, Textarea)
- [ ] **SHW-03**: /showcase/navigation page (Tabs, Breadcrumbs)
- [ ] **SHW-04**: /showcase/feedback page (Toast, Modal, Progress, Alert)
- [ ] **SHW-05**: /showcase/data-display page (Badge, Avatar, Skeleton)
- [ ] **SHW-06**: /showcase/layout page (Container, GlassPanel, GlassCard, Divider)
- [ ] **SHW-07**: /showcase/utilities page (Motion components, Gradients, TrafficLights)
- [ ] **SHW-08**: Each showcase page shows all component variants
- [ ] **SHW-09**: Each showcase page shows all component states
- [ ] **SHW-10**: Showcase follows consistent section pattern

### Verification (VER)

- [ ] **VER-01**: Visual comparison between /showcase and Raycast reference
- [ ] **VER-02**: Token values verified against extracted source values
- [ ] **VER-03**: All color combinations verified for WCAG AA compliance
- [ ] **VER-04**: All components tested in isolation (Storybook/showcase)
- [ ] **VER-05**: All components tested in composition (real page contexts)
- [ ] **VER-06**: No hardcoded values in component code (linted)
- [ ] **VER-07**: Responsive behavior verified (mobile, tablet, desktop)

### Documentation (DOC)

- [ ] **DOC-01**: Token reference document (all values with usage notes)
- [ ] **DOC-02**: Component API documentation (props, variants, examples)
- [ ] **DOC-03**: Usage guidelines (when to use/not use each component)
- [ ] **DOC-04**: Accessibility requirements per component
- [ ] **DOC-05**: BRAND-BIBLE.md updated with complete design system
- [ ] **DOC-06**: Motion guidelines document
- [ ] **DOC-07**: Figma-ready design specs exported
- [ ] **DOC-08**: Component index with links to showcase and source

## Future Milestone

Deferred to v2.1+:

### Storybook Integration
- **STB-01**: Storybook 8 initialized
- **STB-02**: Foundation stories (Colors, Typography, Spacing)
- **STB-03**: Component stories for all primitives
- **STB-04**: Chromatic visual regression testing

### Advanced Features
- **ADV-01**: Light mode theme variant
- **ADV-02**: Style Dictionary pipeline (if Figma sync needed)
- **ADV-03**: Tokens Studio integration
- **ADV-04**: Automated token extraction CI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Light mode | Dark-mode first, light mode deferred to v2.1 |
| Real-time Figma sync | Manual export sufficient for now |
| Complex node animations | Already scoped for future milestone |
| Sound design | Future polish feature |
| Mobile native exports | Web-only for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXT-01 | Phase 39 | Pending |
| EXT-02 | Phase 39 | Pending |
| EXT-03 | Phase 39 | Pending |
| EXT-04 | Phase 39 | Pending |
| EXT-05 | Phase 39 | Pending |
| EXT-06 | Phase 39 | Pending |
| EXT-07 | Phase 39 | Pending |
| EXT-08 | Phase 39 | Pending |
| EXT-09 | Phase 39 | Pending |
| EXT-10 | Phase 39 | Pending |
| EXT-11 | Phase 39 | Pending |
| EXT-12 | Phase 39 | Pending |
| EXT-13 | Phase 39 | Pending |
| COL-01 | Phase 39 | Pending |
| COL-02 | Phase 39 | Pending |
| COL-03 | Phase 39 | Pending |
| COL-04 | Phase 39 | Pending |
| COL-05 | Phase 39 | Pending |
| COL-06 | Phase 39 | Pending |
| COL-07 | Phase 39 | Pending |
| COL-08 | Phase 39 | Pending |
| TYP-01 | Phase 39 | Pending |
| TYP-02 | Phase 39 | Pending |
| TYP-03 | Phase 39 | Pending |
| TYP-04 | Phase 39 | Pending |
| TYP-05 | Phase 39 | Pending |
| TYP-06 | Phase 39 | Pending |
| SPC-01 | Phase 39 | Pending |
| SPC-02 | Phase 39 | Pending |
| SPC-03 | Phase 39 | Pending |
| SPC-04 | Phase 39 | Pending |
| SHD-01 | Phase 39 | Pending |
| SHD-02 | Phase 39 | Pending |
| SHD-03 | Phase 39 | Pending |
| SHD-04 | Phase 39 | Pending |
| BRD-01 | Phase 39 | Pending |
| BRD-02 | Phase 39 | Pending |
| BRD-03 | Phase 39 | Pending |
| ANI-01 | Phase 39 | Pending |
| ANI-02 | Phase 39 | Pending |
| ANI-03 | Phase 39 | Pending |
| ANI-04 | Phase 39 | Pending |
| ANI-05 | Phase 39 | Pending |
| BRK-01 | Phase 39 | Pending |
| BRK-02 | Phase 39 | Pending |
| BRK-03 | Phase 39 | Pending |
| BRK-04 | Phase 39 | Pending |
| BRK-05 | Phase 39 | Pending |
| GRD-01 | Phase 39 | Pending |
| GRD-02 | Phase 39 | Pending |
| GRD-03 | Phase 39 | Pending |
| GRD-04 | Phase 39 | Pending |
| ARC-01 | Phase 39 | Pending |
| ARC-02 | Phase 39 | Pending |
| ARC-03 | Phase 39 | Pending |
| ARC-04 | Phase 39 | Pending |
| ARC-05 | Phase 39 | Pending |
| CMP-01 | Phase 40 | Pending |
| CMP-02 | Phase 40 | Pending |
| CMP-03 | Phase 40 | Pending |
| CMP-04 | Phase 40 | Pending |
| CMP-05 | Phase 40 | Pending |
| CMP-06 | Phase 40 | Pending |
| CMP-07 | Phase 40 | Pending |
| CMP-08 | Phase 40 | Pending |
| CMP-09 | Phase 40 | Pending |
| CMP-10 | Phase 40 | Pending |
| CMP-11 | Phase 40 | Pending |
| CMP-12 | Phase 40 | Pending |
| CMP-13 | Phase 40 | Pending |
| CMQ-01 | Phase 40 | Pending |
| CMQ-02 | Phase 40 | Pending |
| CMQ-03 | Phase 40 | Pending |
| CMQ-04 | Phase 40 | Pending |
| CMQ-05 | Phase 40 | Pending |
| CMQ-06 | Phase 40 | Pending |
| CMX-01 | Phase 41 | Pending |
| CMX-02 | Phase 41 | Pending |
| CMX-03 | Phase 41 | Pending |
| CMX-04 | Phase 41 | Pending |
| CMX-05 | Phase 41 | Pending |
| CMX-06 | Phase 41 | Pending |
| RAY-01 | Phase 41 | Pending |
| RAY-02 | Phase 41 | Pending |
| RAY-03 | Phase 41 | Pending |
| RAY-04 | Phase 41 | Pending |
| RAY-05 | Phase 41 | Pending |
| GLS-01 | Phase 42 | Complete |
| GLS-02 | Phase 42 | Complete |
| GLS-03 | Phase 42 | Complete |
| GLS-04 | Phase 42 | Complete |
| GLS-05 | Phase 42 | Complete |
| GLS-06 | Phase 42 | Complete |
| GLS-07 | Phase 42 | Complete |
| EFX-01 | Phase 42 | Complete |
| EFX-02 | Phase 42 | Complete |
| EFX-03 | Phase 42 | Complete |
| EFX-04 | Phase 42 | Complete |
| EFX-05 | Phase 42 | Complete |
| EFX-06 | Phase 42 | Complete |
| SHW-01 | Phase 43 | Pending |
| SHW-02 | Phase 43 | Pending |
| SHW-03 | Phase 43 | Pending |
| SHW-04 | Phase 43 | Pending |
| SHW-05 | Phase 43 | Pending |
| SHW-06 | Phase 43 | Pending |
| SHW-07 | Phase 43 | Pending |
| SHW-08 | Phase 43 | Pending |
| SHW-09 | Phase 43 | Pending |
| SHW-10 | Phase 43 | Pending |
| VER-01 | Phase 44 | Pending |
| VER-02 | Phase 44 | Pending |
| VER-03 | Phase 44 | Pending |
| VER-04 | Phase 44 | Pending |
| VER-05 | Phase 44 | Pending |
| VER-06 | Phase 44 | Pending |
| VER-07 | Phase 44 | Pending |
| DOC-01 | Phase 44 | Pending |
| DOC-02 | Phase 44 | Pending |
| DOC-03 | Phase 44 | Pending |
| DOC-04 | Phase 44 | Pending |
| DOC-05 | Phase 44 | Pending |
| DOC-06 | Phase 44 | Pending |
| DOC-07 | Phase 44 | Pending |
| DOC-08 | Phase 44 | Pending |

**Coverage:**
- v2.0 requirements: 125 total
- Mapped to phases: 125
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 — Traceability table populated with phase mappings*
