# Requirements: Virtuna v2.1 Dashboard Rebuild

**Defined:** 2026-02-05
**Core Value:** Raycast-quality design system applied to dashboard with hive node visualization

## v2.1 Requirements

### Sidebar

- [ ] **SIDE-01**: Sidebar uses GlassPanel with glassmorphic blur/border as floating panel
- [ ] **SIDE-02**: Sidebar is always visible on desktop and pushes main content
- [ ] **SIDE-03**: Sidebar nav items use design system Button (ghost variant) + Icon
- [ ] **SIDE-04**: SocietySelector uses design system Select component
- [ ] **SIDE-05**: ViewSelector uses design system Select component
- [ ] **SIDE-06**: Test history list uses design system Typography (Text, Caption)
- [ ] **SIDE-07**: Sidebar collapses to icon-only mode with smooth animation
- [ ] **SIDE-08**: Collapse state persists across sessions (Zustand + localStorage)

### Forms & Test Creation

- [ ] **FORM-01**: ContentForm uses design system GlassTextarea + Button
- [ ] **FORM-02**: SurveyForm uses design system GlassInput + Select + Button
- [ ] **FORM-03**: TestTypeSelector uses design system Dialog + GlassCard grid
- [ ] **FORM-04**: Create test button uses design system Button (primary variant)
- [ ] **FORM-05**: All form inputs use design system focus rings and error states

### Modals

- [ ] **MODL-01**: CreateSocietyModal uses design system Dialog + GlassTextarea + Button
- [ ] **MODL-02**: DeleteTestModal uses design system Dialog + Button (destructive)
- [ ] **MODL-03**: LeaveFeedbackModal uses design system Dialog + GlassInput + GlassTextarea + Button
- [ ] **MODL-04**: SocietySelector modal uses design system Dialog + GlassCard
- [ ] **MODL-05**: All modals use consistent overlay, animation, and close behavior from design system Dialog

### Results Panel

- [ ] **RSLT-01**: ResultsPanel wrapper uses GlassPanel with design system tokens
- [ ] **RSLT-02**: ImpactScore uses design system Typography + Badge
- [ ] **RSLT-03**: AttentionBreakdown uses design system GlassProgress bars
- [ ] **RSLT-04**: VariantsSection uses GlassCard per variant
- [ ] **RSLT-05**: InsightsSection uses GlassCard + Badge
- [ ] **RSLT-06**: ThemesSection uses GlassCard + GlassProgress
- [ ] **RSLT-07**: ShareButton uses design system Button (ghost variant)

### Top Bar

- [ ] **TBAR-01**: ContextBar uses design system Typography tokens
- [ ] **TBAR-02**: FilterPills use design system GlassPill components
- [ ] **TBAR-03**: LegendPills use design system GlassPill with tint colors
- [ ] **TBAR-04**: All top bar elements use design system spacing and color tokens

### Loading States

- [ ] **LOAD-01**: LoadingPhases uses GlassPanel wrapper + GlassProgress bar
- [ ] **LOAD-02**: Loading phases use design system Spinner component
- [ ] **LOAD-03**: Cancel button uses design system Button (secondary variant)

### Mobile

- [ ] **MOBL-01**: Mobile nav updated for floating sidebar behavior
- [ ] **MOBL-02**: Sidebar collapses to hidden on mobile with hamburger toggle
- [ ] **MOBL-03**: Backdrop-filter limited to 2 glass elements on mobile viewport

### Hive Visualization

- [ ] **HIVE-01**: Center rounded rectangle renders as video/script thumbnail placeholder
- [ ] **HIVE-02**: 10+ main nodes (tier 1) positioned in radial ring around center
- [ ] **HIVE-03**: 100+ sub-nodes (tier 2) connected to main nodes in secondary ring
- [ ] **HIVE-04**: 1000+ leaf nodes (tier 3) as decorative outermost layer
- [ ] **HIVE-05**: Connection lines between tiers with distance-based opacity
- [ ] **HIVE-06**: Radial layout computed with d3-hierarchy (deterministic positions)
- [ ] **HIVE-07**: Canvas 2D rendering at 60fps with retina/HiDPI support
- [ ] **HIVE-08**: Responsive sizing via ResizeObserver
- [ ] **HIVE-09**: Reduced motion fallback (static layout, no animations)

### Hive Interactions

- [ ] **HINT-01**: Click on node triggers glow/scale visual effect
- [ ] **HINT-02**: Click on node shows GlassCard info overlay positioned near node
- [ ] **HINT-03**: Hover on node highlights the node and its connected nodes
- [ ] **HINT-04**: Hover dims non-connected nodes for contrast
- [ ] **HINT-05**: Hit detection uses d3-quadtree for O(log n) performance
- [ ] **HINT-06**: Hover state debounced to prevent flickering in dense clusters
- [ ] **HINT-07**: Zoom/pan controls for exploring the hive

## Future Requirements

### Analysis Effects (v2.2+)

- **ANIM-01**: Node entry animation (stagger reveal from center outward)
- **ANIM-02**: Pulsing glow on active/selected node during analysis
- **ANIM-03**: Connection line glow on hover path
- **ANIM-04**: Smooth transition between idle and results states

### Differentiators (v2.2+)

- **DIFF-01**: Ambient glow behind sidebar (GradientGlow coral)
- **DIFF-02**: Tier-based color coding (coral/purple/blue/cyan rings)
- **DIFF-03**: Mouse proximity reactive nodes (grow/brighten on approach)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Light mode theme | Dark-mode first, defer later |
| 3D node rotation/depth | Hive is fundamentally 2D hierarchical |
| Force-directed physics layout | Hive has fixed structure, d3-hierarchy is deterministic |
| SVG-based node rendering | SVG DOM too expensive at 1000+ nodes |
| Real-time data mapping to nodes | Nodes are decorative for now |
| Backend/API integration | UI-first milestone, backend comes later |
| AI-generated storyboard images | Different milestone scope |
| Node analysis animations | Deferred to v2.2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIDE-01 | Pending | Pending |
| SIDE-02 | Pending | Pending |
| SIDE-03 | Pending | Pending |
| SIDE-04 | Pending | Pending |
| SIDE-05 | Pending | Pending |
| SIDE-06 | Pending | Pending |
| SIDE-07 | Pending | Pending |
| SIDE-08 | Pending | Pending |
| FORM-01 | Pending | Pending |
| FORM-02 | Pending | Pending |
| FORM-03 | Pending | Pending |
| FORM-04 | Pending | Pending |
| FORM-05 | Pending | Pending |
| MODL-01 | Pending | Pending |
| MODL-02 | Pending | Pending |
| MODL-03 | Pending | Pending |
| MODL-04 | Pending | Pending |
| MODL-05 | Pending | Pending |
| RSLT-01 | Pending | Pending |
| RSLT-02 | Pending | Pending |
| RSLT-03 | Pending | Pending |
| RSLT-04 | Pending | Pending |
| RSLT-05 | Pending | Pending |
| RSLT-06 | Pending | Pending |
| RSLT-07 | Pending | Pending |
| TBAR-01 | Pending | Pending |
| TBAR-02 | Pending | Pending |
| TBAR-03 | Pending | Pending |
| TBAR-04 | Pending | Pending |
| LOAD-01 | Pending | Pending |
| LOAD-02 | Pending | Pending |
| LOAD-03 | Pending | Pending |
| MOBL-01 | Pending | Pending |
| MOBL-02 | Pending | Pending |
| MOBL-03 | Pending | Pending |
| HIVE-01 | Pending | Pending |
| HIVE-02 | Pending | Pending |
| HIVE-03 | Pending | Pending |
| HIVE-04 | Pending | Pending |
| HIVE-05 | Pending | Pending |
| HIVE-06 | Pending | Pending |
| HIVE-07 | Pending | Pending |
| HIVE-08 | Pending | Pending |
| HIVE-09 | Pending | Pending |
| HINT-01 | Pending | Pending |
| HINT-02 | Pending | Pending |
| HINT-03 | Pending | Pending |
| HINT-04 | Pending | Pending |
| HINT-05 | Pending | Pending |
| HINT-06 | Pending | Pending |
| HINT-07 | Pending | Pending |

**Coverage:**
- v2.1 requirements: 46 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 46

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after initial definition*
