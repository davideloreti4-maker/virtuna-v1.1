# Research Summary: Design System Foundation

**Project:** Virtuna v2.0 — Design System Extraction & Implementation
**Domain:** Design System Extraction (Raycast to Coral)
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

This milestone focuses on extracting Raycast's design language from raycast.com and implementing it with Virtuna's coral (#FF7F50) branding. The project already has a solid Tailwind v4 foundation with comprehensive design tokens in `globals.css`. Research reveals three critical insights: (1) automated extraction tools (Dembrandt, Superposition) can validate existing tokens and capture missing values, (2) coral accessibility requires careful handling since #FF7F50 fails WCAG contrast on white backgrounds (2.9:1 vs required 4.5:1), and (3) a two-tier token architecture (primitive → semantic) provides optimal maintainability.

The recommended approach: validate existing token extraction using Dembrandt CLI, generate a full coral scale (100-900) with accessibility verification, implement two-tier token architecture in `globals.css`, build component showcase following category-based organization, and document everything for future development. Key risks center on design drift (teams overriding styles), coral accessibility failures, and extracting computed styles instead of authored styles.

The design system follows Raycast's signature aesthetic—dark-mode first, glassmorphism effects, generous spacing, and keyboard-first visual language—but swaps brand colors to coral while maintaining semantic colors (red for error, green for success). The `/showcase` component library provides visual reference and interactive demos organized by function (inputs, navigation, feedback, data-display, layout, utilities).

## Key Findings

### Recommended Stack

Extraction and documentation tools selected for systematic design system capture and maintenance. Tailwind v4's CSS-first `@theme` directive eliminates need for separate config file—all tokens live in `globals.css` with semantic naming.

**Core technologies:**
- **Dembrandt (CLI extraction)**: Bulk token extraction in W3C DTCG format — confidence-scored output, compatible with Style Dictionary pipeline
- **Tailwind v4 @theme**: Token-to-utility mapping — already correctly configured, CSS-first approach superior to v3 config file
- **Storybook 8**: Component documentation — purpose-built for design systems, React 19 support, visual regression via Chromatic
- **Style Dictionary**: Token transformation pipeline (optional) — use only if Figma sync or multi-platform export needed
- **Superposition (Desktop)**: Interactive extraction — visual exploration, quick verification, designer collaboration

**Extraction workflow:**
1. Validate existing `globals.css` tokens against raycast.com using Dembrandt
2. Capture interaction states (hover, focus, active) using Playwright + DevTools
3. Document coral-specific accessibility requirements
4. Build Storybook foundation stories (colors, typography, spacing, shadows)
5. Add component stories as components are built

**Critical version requirements:**
- Tailwind v4.x (already installed) — `@theme` directive required
- Storybook 8.x (not yet installed) — React 19 compatibility
- Node.js with Playwright (existing) — screenshot automation in `/extraction/`

### Expected Features

Design system deliverables organized by complexity and dependencies. Foundation tokens must exist before components can be built. Glassmorphism is the signature differentiator.

**Must have (table stakes):**
- **Color tokens** (primitive + semantic) — background hierarchy, text colors, coral brand scale, semantic states (error/success/warning/info)
- **Typography tokens** — font families, size scale (4-6 values), weights, line heights, letter spacing
- **Spacing scale** — 6-8 values in geometric progression, component-specific spacing
- **Shadow system** — 3-4 elevation levels, glass-specific shadows
- **Border radius** — 4 core values (sm, md, lg, xl)
- **Core components** — Button (3 variants, all states), Card, Input, Badge, Typography, Icon integration
- **Token documentation** — Getting started, token reference, component API with copy-paste examples

**Should have (differentiators):**
- **Glassmorphism card variant** — Raycast signature aesthetic, backdrop-filter blur (12-20px), semi-transparent backgrounds (0.1-0.2 opacity), border glow
- **Dark-mode first tokens** — designed for dark backgrounds, light mode as future adaptation
- **Animation patterns** — fade-in-up (Raycast signature), staggered reveals, micro-interactions, loading skeletons
- **Keyboard-first visual language** — key caps, shortcut badges, command palette patterns
- **Gradient system** — multi-stop gradients for depth, coral gradient range (light #FFB08A to dark #CC5533)
- **Advanced documentation** — Figma specifications (if designer handoff), motion guidelines, theming guide

**Defer (v2+):**
- **Additional components** — Select/Dropdown, Modal/Dialog, Toast/Alert, Tabs, Avatar, Spinner, Divider, Command palette
- **Multi-theme support** — light/dark switching, brand variants (coral → other colors)
- **Advanced effects** — chromatic aberration, noise textures, gradient mesh utilities
- **W3C Design Token Format export** — JSON format for tool interoperability
- **Style Dictionary pipeline** — only if Figma sync or native app token export needed

**Critical MVP scope:**
- Foundation tokens (colors, typography, spacing, shadows, radius)
- 6 core components (Button, Card, Input, Badge, Typography, Icon pattern)
- One signature effect (glassmorphism card)
- Basic documentation (install, tokens, component examples)

### Architecture Approach

Two-tier token system provides optimal balance of flexibility and maintainability. Primitive tokens (raw values) map to semantic tokens (intent-based) which are used in components. Never use primitives directly.

**Token architecture:**
```
Tier 1: Primitives (raw values)
  └── Tier 2: Semantic (intent-based) ← USE THESE IN COMPONENTS
```

**File structure:**
```
src/
├── app/
│   ├── globals.css              # All tokens via @theme + base styles
│   └── (marketing)/showcase/    # Component library
│       ├── page.tsx             # Overview + tokens demo
│       ├── inputs/page.tsx      # Form inputs
│       ├── navigation/page.tsx  # Navigation components
│       ├── feedback/page.tsx    # Feedback & overlays
│       ├── data-display/page.tsx
│       ├── layout/page.tsx
│       └── utilities/page.tsx
├── components/
│   ├── primitives/              # Virtuna-specific (Glass*, Gradient*)
│   ├── ui/                      # Generic reusable (Button, Input, Card)
│   ├── layout/                  # Layout components
│   └── motion/                  # Animation wrappers
└── types/
    └── design-system.ts         # Shared type definitions
```

**Major components:**
1. **Token foundation** (`globals.css` with `@theme`) — Single source of truth for all design tokens, primitive + semantic layers
2. **Component showcase** (`/showcase`) — Category-based organization (inputs, navigation, feedback, data-display, layout, utilities), visual reference with interactive demos
3. **Primitives library** (`components/primitives/`) — Virtuna-specific components (GlassPanel, GlassCard, GlassInput, etc.), barrel exports with TypeScript types
4. **Documentation** — BRAND-BIBLE.md (complete reference), component JSDoc (API docs), `/showcase` (visual demos), `globals.css` (token definitions with comments)

**Build order (dependencies):**
1. **Phase 1: Token foundation** — Refactor `globals.css` with two-tier tokens, add shared type definitions
2. **Phase 2: Component refinement** — Update component prop types, enhance JSDoc documentation
3. **Phase 3: Showcase enhancement** — Add missing showcase pages, standardize format
4. **Phase 4: Documentation polish** — Update BRAND-BIBLE.md, create component index

**Naming conventions:**
- `--primitive-*`: Raw values (never use directly in components)
- `--color-*`: Semantic color tokens (use these)
- `--spacing-*`: Semantic spacing tokens
- `--radius-*`, `--shadow-*`, `--duration-*`: Category-based prefixes
- Always kebab-case, lowercase only, namespace prefix matches Tailwind utility

### Critical Pitfalls

Top 5 risks with prevention strategies. Design drift is the silent killer—establish governance before writing any component code.

1. **Design Drift from Day One** — Teams override styles to hit deadlines, tokens get duplicated, "just one more exception" compounds exponentially
   - **Prevention:** Establish governance rules in Phase 1, use lint rules for hardcoded values, build visual regression tests immediately, make using tokens easier than overriding

2. **Coral Accessibility Failure** — #FF7F50 fails WCAG contrast on white (2.9:1 vs required 4.5:1), makes UI inaccessible to 2.2 billion people with visual impairments
   - **Prevention:** Generate full coral scale (100-900) with verified contrast ratios, use darkened coral (#C85400) for text on white, test every text/background combination, use WebAIM Contrast Checker

3. **Extracting Computed Styles Not Authored** — DevTools show computed values (16px) not authored (1rem), loses design intent, breaks responsive scaling
   - **Prevention:** Use DevTools Styles tab (not Computed), trace back to original declarations, verify relative units preserved, use extraction tools accessing Chrome DevTools Protocol

4. **Tailwind Dynamic Class Compilation Failure** — String interpolation creates class names (`bg-${color}-500`) that don't exist at build time, styles in HTML but not CSS
   - **Prevention:** Never interpolate Tailwind classes, use safelist in config for programmatic classes, create class mapping objects with literal values, use CSS custom properties for dynamic values

5. **Flat Token Structure** — All tokens at same level with no hierarchy, impossible to understand relationships, can't create themes
   - **Prevention:** Use three-tier architecture from day one (primitive → semantic → component), document tier relationships, never use primitive tokens directly in components, automate validation in CI

**Additional critical risks:**
- **Naming collisions** — Use consistent `vt-` prefix, follow `[prefix]-[category]-[property]-[variant]` structure, lowercase only
- **Missing context-dependent values** — Extract all states (default, hover, focus, active, disabled, error, loading), capture dark mode variants
- **Non-perceptual color scaling** — Use OKLCH/LAB for coral scale generation, hand-tune 800/900 shades (orange family shifts brown), compare against established orange scales
- **Documentation written once, never updated** — Co-locate docs with code (Storybook, TSDoc), make updates part of PR requirements, use automated generation
- **Testing components in isolation only** — Test in Storybook AND realistic page compositions, create integration stories, test cascading scenarios

## Implications for Roadmap

Based on research, design system implementation should follow strict dependency order. Foundation tokens must be validated and refined before component work. Glassmorphism signature effect differentiates from generic design systems.

### Phase 1: Token Validation & Coral Accessibility
**Rationale:** Current `globals.css` has comprehensive tokens but needs validation against source and coral-specific accessibility verification. Foundation must be solid before components.

**Delivers:**
- Validated extraction accuracy using Dembrandt CLI
- Two-tier token architecture (primitive + semantic) in `globals.css`
- Accessible coral scale (100-900) with documented contrast ratios
- Coral variants for text on light backgrounds
- Semantic color mappings (brand, feedback, text)
- Updated BRAND-BIBLE.md with token tier explanation

**Addresses features:**
- Color tokens (primitives + semantic)
- Typography tokens
- Spacing scale
- Shadow system
- Border radius

**Avoids pitfalls:**
- Design drift (#1) — establish governance rules before component work
- Coral accessibility failure (#2) — verify all contrast ratios upfront
- Extracting computed styles (#3) — validate extraction protocol
- Flat token structure (#5) — implement two-tier architecture now
- Non-perceptual color scaling — use OKLCH for coral generation

**Research needed:** None — extraction patterns well-documented

---

### Phase 2: Core Component Implementation
**Rationale:** Build MVP component set following strict token usage. Button → Card → Input order respects dependencies. JSDoc documentation co-located with code.

**Delivers:**
- Button component (3 variants: primary/secondary/ghost, all states)
- Card component (basic variant + glassmorphism variant)
- Input component (text, password, search with label/error/helper)
- Badge component (semantic colors, sizes)
- Typography components (heading levels, body, caption, code)
- Icon integration pattern
- Shared TypeScript types (`types/design-system.ts`)

**Addresses features:**
- Core components (must-have)
- Glassmorphism card variant (differentiator)
- Component API documentation

**Avoids pitfalls:**
- Tailwind dynamic class compilation (#4) — establish class mapping patterns
- Naming collisions — use shared type definitions
- Missing context-dependent values — capture all interactive states

**Research needed:** None — component patterns established

---

### Phase 3: Showcase & Visual Verification
**Rationale:** Visual documentation prevents drift and enables automated verification. Showcase demonstrates all component variants and states. Visual regression catches unintended changes.

**Delivers:**
- `/showcase/layout` page (Container, GlassPanel, GlassCard, Divider)
- `/showcase/utilities` page (motion components, gradients, TrafficLights)
- Standardized showcase format across all category pages
- Code snippets with copy buttons
- Storybook 8 initialization with foundation stories
- Visual regression testing setup (Chromatic or Percy)

**Addresses features:**
- Token documentation
- Component API with examples
- Usage guidelines

**Avoids pitfalls:**
- Testing components in isolation only — include composition examples
- Documentation written once, never updated — establish update requirements
- Manual verification doesn't scale — automate with visual regression
- Pixel-perfect false positives — tune comparison thresholds

**Research needed:** None — Storybook patterns well-documented

---

### Phase 4: Animation & Advanced Effects
**Rationale:** Signature Raycast aesthetic depends on animation patterns and glassmorphism effects. These build on solid component foundation and can be added incrementally.

**Delivers:**
- Animation tokens (duration, easing)
- Motion components (FadeIn, SlideUp, Stagger)
- Glassmorphism variants (tinted glass iOS 26 style)
- Gradient utilities (coral gradient range)
- Micro-interaction patterns (hover scale, press feedback)
- Motion guidelines documentation

**Addresses features:**
- Animation patterns (differentiator)
- Keyboard-first visual language
- Gradient system
- Advanced documentation

**Avoids pitfalls:**
- Animation on everything — document when to use motion meaningfully
- Glassmorphism everywhere — reserve for key UI surfaces only

**Research needed:** None — animation patterns established

---

### Phase 5: Documentation Polish & Figma Export (Optional)
**Rationale:** Professional design systems require comprehensive documentation and designer handoff materials. This phase adds polish after core functionality complete.

**Delivers:**
- Complete BRAND-BIBLE.md update with cross-references
- Component index with links to showcase and source
- Figma-ready specifications (if designer handoff needed)
- Style Dictionary pipeline setup (if Figma sync needed)
- Usage guidelines (when to use, when not to use)
- Do/Don't visual examples

**Addresses features:**
- Advanced documentation (differentiator)
- Figma specifications
- Theming guide

**Avoids pitfalls:**
- Documenting what, not why — include usage guidelines and constraints
- Over-engineering warning signs — only add if 2+ real uses exist

**Research needed:** None unless Figma sync required (then research Tokens Studio workflow)

---

### Phase Ordering Rationale

**Foundation-first approach:**
- Tokens must exist before components (Phase 1 before Phase 2)
- Components must exist before showcase (Phase 2 before Phase 3)
- Solid foundation enables animation layer (Phase 2-3 before Phase 4)
- Documentation polish after core functionality (Phase 5 last)

**Dependency chain:**
1. Tokens (colors, typography, spacing) → nothing depends on this
2. Components (Button, Card, Input) → depends on tokens
3. Showcase (visual demos) → depends on components
4. Animation (motion patterns) → depends on components + tokens
5. Documentation (polish) → depends on everything

**Pitfall mitigation:**
- Design drift addressed in Phase 1 (governance before code)
- Accessibility verified in Phase 1 (coral scale with contrast ratios)
- Visual regression in Phase 3 (automated verification)
- Documentation-as-code throughout (JSDoc, Storybook)

**Incremental delivery:**
- Each phase delivers shippable artifacts
- MVP = Phase 1 + Phase 2 (tokens + core components)
- Professional quality = MVP + Phase 3 (showcase + verification)
- Premium quality = all phases including animation and docs

### Research Flags

**Phases with standard patterns (skip `/gsd:research-phase`):**
- **Phase 1:** Token extraction patterns well-documented (Dembrandt, DevTools, OKLCH color spaces)
- **Phase 2:** Component patterns established (React/TypeScript, Tailwind v4, JSDoc)
- **Phase 3:** Storybook patterns documented (official docs, addon ecosystem)
- **Phase 4:** Animation patterns established (CSS transitions, Framer Motion if needed)

**Phases that may need deeper research:**
- **Phase 5 (only if Figma sync required):** Tokens Studio workflow, Style Dictionary transforms, W3C DTCG format — research only if designer handoff is confirmed requirement

**Research complete for MVP (Phase 1-3):** All patterns documented, no additional research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tailwind v4 official docs verified, extraction tools active repos, Storybook 8 React 19 support confirmed |
| Features | HIGH | Token categories standard, component patterns established, glassmorphism implementation verified |
| Architecture | HIGH | Tailwind v4 @theme patterns official, two-tier token architecture industry standard, file structure working |
| Pitfalls | HIGH | Design drift industry-wide problem, WCAG requirements explicit, extraction pitfalls documented |

**Overall confidence:** HIGH

### Gaps to Address

**Coral-specific color tuning:** Automated OKLCH generation will produce mathematically correct scale, but orange family tends toward brown in dark shades (800/900). Hand-tuning likely needed. Validate generated scale against Tailwind's orange and Radix Orange for reference.

**Extraction accuracy verification:** Current `globals.css` tokens extracted previously but accuracy not yet verified against live raycast.com. Dembrandt extraction in Phase 1 will identify any missing values or drift.

**Storybook integration:** Next.js App Router + React 19 + Storybook 8 configuration not yet tested. Initialization in Phase 3 may reveal configuration edge cases. Official Storybook docs cover this setup.

**Visual regression tool selection:** Chromatic vs Percy vs BackstopJS evaluation deferred to Phase 3. All are mature tools; selection based on budget and team workflow preferences.

**Figma sync requirement:** Not yet confirmed whether designer handoff needed. If confirmed, Phase 5 research required for Tokens Studio + Style Dictionary workflow.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Theme variables, CSS-first configuration
- [Tailwind CSS v4 Theme Documentation](https://tailwindcss.com/docs/theme) — @theme directive, token mapping
- [W3C Design Tokens Specification](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) — Token format standard (October 2025)
- [Raycast API Colors](https://developers.raycast.com/api-reference/user-interface/colors) — Raycast color system
- [Raycast User Interface API](https://developers.raycast.com/api-reference/user-interface) — Component patterns
- [Storybook 8 Release](https://storybook.js.org/blog/storybook-8/) — React 19 support, performance improvements
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — WCAG accessibility verification

### Secondary (MEDIUM confidence)
- [Dembrandt GitHub](https://github.com/dembrandt/dembrandt) — CLI extraction tool
- [Superposition](https://superposition.design/) — Desktop extraction app
- [Style Dictionary Documentation](https://styledictionary.com/) — Token transformation pipeline
- [Tokens Studio Documentation](https://docs.tokens.studio) — Figma integration
- [Design Token-Based UI Architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html) — Token architecture patterns
- [Naming Tokens in Design Systems](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676) — Nathan Curtis, naming conventions
- [Glassmorphism CSS Generator](https://ui.glass/generator/) — Implementation reference
- [Accessible Palette](https://accessiblepalette.com/) — Perceptual color scaling with WCAG verification

### Tertiary (for context)
- [Design Systems Pitfalls](https://rydarashid.medium.com/design-systems-in-2026-predictions-pitfalls-and-power-moves-f401317f7563) — Common mistakes
- [Tailwind CSS Best Practices 2025](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) — Design system patterns
- [UXPin Design System Components](https://www.uxpin.com/studio/blog/design-system-components/) — Essential component list
- [Visual Regression Testing Best Practices](https://medium.com/@ss-tech/the-ui-visual-regression-testing-best-practices-playbook-dc27db61ebe0) — VRT patterns

---
*Research synthesized: 2026-02-03*
*Ready for roadmap: yes*
