# Pitfalls Research: Design System Extraction & Implementation

**Domain:** Design System Extraction & Implementation
**Researched:** 2026-02-03
**Overall Confidence:** HIGH

---

## Executive Summary

**Top 3 Risks to Watch:**

1. **Design Drift** - The silent killer of design systems. Teams override styles to hit deadlines, tokens get duplicated, "just one more exception" compounds. Within weeks, you have inconsistent shades, competing sizes, and conflicting naming conventions.

2. **Coral Accessibility Failure** - Coral (#FF7F50) fails WCAG contrast requirements on white backgrounds (~2.9:1 vs required 4.5:1). Direct color swap without accessibility verification will make UI inaccessible to 2.2 billion people with visual impairments.

3. **Computed vs Authored Extraction** - Extracting computed styles (16px) instead of authored styles (1rem) loses design intent. Responsive scaling breaks, CSS custom properties resolve to final values, and the extracted system won't adapt properly.

---

## Critical Pitfalls

### Pitfall 1: Design Drift from Day One

**What goes wrong:** Teams override styles "just this once" to hit deadlines. Within weeks, the system has inconsistent shades, competing sizes, and conflicting naming conventions.

**Why it happens:**
- Different teams move at different speeds
- Tokens get duplicated rather than reused
- Engineers override styles to ship faster
- "Just one more exception" compounds exponentially
- Making the wrong thing (overriding) is easier than the right thing (using tokens)

**How to avoid:**
- Establish strict governance before writing any component code
- Use lint rules to catch hardcoded values (e.g., ESLint plugin for Tailwind class consistency)
- Make the right thing the easy thing - if overriding is easier than using tokens, developers will override
- Build visual regression tests from Phase 1

**Warning signs:**
- Pull requests with hardcoded hex values instead of token references
- Multiple shades of the same conceptual color appearing in the codebase
- Developers asking "which gray is the right gray?"
- Components with inline styles
- CSS files growing with one-off values

**Phase to address:** Phase 1 (Foundation) - establish governance rules before any component work

---

### Pitfall 2: Extracting Computed Styles Instead of Authored Styles

**What goes wrong:** Browser DevTools show computed values (16px) not authored values (1rem). Extracting computed styles loses the original design intent and breaks responsive scaling.

**Why it happens:**
- DevTools Computed tab shows final rendered values
- `getComputedStyle()` returns absolute values, not relative ones
- CSS variables resolve to final values in computed output
- Media queries and cascade information is flattened
- Relative units (rem, em, %) become absolute (px)

**How to avoid:**
- Use DevTools Styles/Rules tab, not Computed tab
- Look for CSS custom properties in source stylesheets
- Trace values back to their original declarations
- Verify units are relative (rem, em, %) not absolute (px) where appropriate
- Use extraction tools that access Chrome DevTools Protocol for authored styles

**Warning signs:**
- All spacing values in exact pixels (16px, 32px) with no apparent scale relationship
- No CSS custom properties in extracted values
- Lost responsive breakpoint information
- Font sizes that don't scale with browser settings
- Values that don't follow a clear mathematical progression

**Phase to address:** Phase 1 (Extraction) - establish extraction protocol before capturing any values

---

### Pitfall 3: Coral Accessibility Failure

**What goes wrong:** Coral (#FF7F50) fails WCAG contrast requirements on white backgrounds. UI becomes inaccessible to 2.2 billion people with visual impairments.

**Why it happens:**
- Coral is a midtone color (not light, not dark)
- Direct brand color swap assumes original colors had same accessibility profile
- Raycast's purple/blue likely have different contrast characteristics than coral
- Teams test appearance but not accessibility
- WCAG 2.0 requires 4.5:1 for normal text, 3:1 for large text

**How to avoid:**
- Generate a full coral scale (100-900) with calculated contrast ratios
- Use "magic number" approach: 50+ difference between text and background grades
- Test every text/background combination against WCAG 2.0 AA (4.5:1 for normal text, 3:1 for large text)
- Create accessible coral variants: darker corals for text on light backgrounds
- Use tools like WebAIM Contrast Checker or Accessible Palette

**Warning signs:**
- Coral text on white background (will fail contrast)
- White text on coral background without verification
- Interactive elements (buttons, links) using coral without contrast check
- Designs that "look good" but haven't been checked with contrast tools
- No documented contrast ratios for color combinations

**Phase to address:** Phase 1 (Color extraction) - build accessibility verification into color token generation

**Specific coral guidance:**
- Pure coral (#FF7F50) on white = ~2.9:1 (FAILS AA normal text)
- Need darkened coral (~#C85400) for 4.5:1 on white
- Consider coral for backgrounds with dark text instead of coral text on light backgrounds
- Orange family shifts toward brown when darkened - hand-tune 800/900 shades

---

### Pitfall 4: Naming Collisions Breaking Token System

**What goes wrong:** Two tokens get the same name with different values. Build systems don't know which to use. Styles become unpredictable.

**Why it happens:**
- No prefix convention established
- Different people name similar concepts differently
- Merging multiple extraction sources
- Shorthand names collide (e.g., "type" for "typography")
- CSS custom properties are case-sensitive (`--my-color` vs `--My-color`)

**How to avoid:**
- Use consistent prefix (`vt-` for Virtuna tokens)
- Follow structure: `[prefix]-[category]-[property]-[variant]-[state]`
- Document naming convention before extraction begins
- Automated validation in CI to catch collisions
- Use lowercase only (CSS convention)

**Warning signs:**
- Build warnings about duplicate custom properties
- Styles rendering differently than expected
- "Which `--color-primary` do you mean?" conversations
- Token values changing unexpectedly
- Different files defining same token name

**Phase to address:** Phase 1 (Token architecture) - define naming convention before capturing first token

---

### Pitfall 5: Tailwind Dynamic Class Compilation Failure

**What goes wrong:** Dynamic class names (e.g., `bg-${color}-500`) don't render. Styles appear in HTML but aren't in compiled CSS.

**Why it happens:**
- Tailwind scans source files at build time
- It only includes classes it can find as literal strings
- String interpolation creates class names that don't exist as literals
- Tailwind can't know that `bg-red-500` should exist if you wrote `bg-${color}-500`

**How to avoid:**
- Never interpolate Tailwind class names
- Use safelist in `tailwind.config.js` for programmatic classes
- Create class mapping objects with all possible values as literals
- Use CSS custom properties for dynamic values instead of dynamic classes

**Warning signs:**
- Classes appearing in HTML inspector but no styles applied
- Styles working in development but not production
- "It worked when I hardcoded it" debugging sessions
- Inconsistent behavior between hot reload and full build
- Build size smaller than expected

**Phase to address:** Phase 2 (Tailwind configuration) - document pattern constraints before component development

**Code example of the problem:**
```typescript
// BROKEN - Tailwind can't find this at build time
const color = 'coral';
return <div className={`bg-${color}-500`} />;

// WORKING - Use safelist or explicit mapping
const colorMap = {
  coral: 'bg-coral-500',
  gray: 'bg-gray-500'
};
return <div className={colorMap[color]} />;
```

---

## Extraction-Specific Pitfalls

### Pitfall 6: Missing Context-Dependent Values

**What goes wrong:** Extracted values only capture one state. Hover, focus, active, disabled states are missing. Dark mode values are lost.

**Why it happens:**
- DevTools shows current state only
- Extractors don't trigger all interactive states
- Dark mode requires toggling system preferences
- Responsive values require resizing viewport
- Focus states need keyboard navigation to trigger

**How to avoid:**
- Create extraction checklist: default, hover, focus, active, disabled, error, loading
- Extract both light and dark mode values
- Capture values at multiple viewport sizes
- Document which states each component supports
- Use `:hov` panel in DevTools to force states

**Warning signs:**
- Components that don't respond to hover
- Missing focus rings for accessibility
- Jarring transitions when states change
- Dark mode toggle breaks appearance
- Mobile layout differs from extracted values

**Phase to address:** Phase 1 (Extraction) - extraction protocol must include all states

---

### Pitfall 7: Extracting Presentation Without Semantics

**What goes wrong:** You capture "blue button" but not "primary action button." Renaming becomes impossible, theming breaks, developers don't understand intent.

**Why it happens:**
- CSS class names are often presentational (`.blue-btn`)
- Visual inspection reveals appearance, not purpose
- Extraction tools capture values, not meaning
- Reference site's naming may not follow semantic conventions

**How to avoid:**
- Map extracted values to semantic names: `blue -> primary`, `gray -> neutral`
- Document the purpose of each token, not just its value
- Create three tiers: raw values -> semantic tokens -> component tokens
- Test understanding: "What color should a primary button be?" should have one answer

**Warning signs:**
- Token names describe appearance (`--blue-500`) not purpose (`--color-primary`)
- Changing brand color requires finding all "blue" references
- Developers guess which color to use
- Different developers choose different tokens for same purpose
- Theming requires changing hundreds of references

**Phase to address:** Phase 1 (Token architecture) - define semantic layer before extraction

---

### Pitfall 8: CSS Custom Properties Scope Confusion

**What goes wrong:** CSS custom properties defined in `:root` can be overridden by any component, breaking the design system's integrity.

**Why it happens:**
- CSS custom properties cascade and inherit
- Any component can redefine `--color-primary`
- There's no "private" scope in CSS
- Teams hard-code values to "fix" problems
- Child components inherit and can override parent values

**How to avoid:**
- Use prefixed property names (`--vt-color-primary`)
- Document that token overriding is prohibited
- Use Stylelint rules to catch direct property redefinition
- Consider CSS-in-JS or CSS Modules for component-scoped overrides
- Never evaluate variables in `:root` if they need to change per-element

**Warning signs:**
- Components rendering with unexpected colors
- "It works in isolation but not in context"
- Styles changing based on parent components
- DevTools showing unexpected property sources
- Same property with different values in cascade

**Phase to address:** Phase 2 (Tailwind configuration) - establish scope boundaries

---

## Color Substitution Pitfalls

### Pitfall 9: Non-Perceptual Color Scaling

**What goes wrong:** Coral scale (100-900) generated mathematically doesn't look visually consistent. Light shades feel washed out, dark shades turn muddy brown.

**Why it happens:**
- RGB/HEX scaling isn't perceptually uniform
- Human color perception is non-linear
- Orange/coral shifts toward brown when darkened
- Coral shifts toward pink when lightened
- Mathematical interpolation ignores visual perception

**How to avoid:**
- Use perceptually uniform color spaces (OKLCH, LAB, LCH) for scale generation
- Hand-tune problematic shades (especially 800, 900 for orange family)
- Test full scale in realistic UI contexts
- Compare against established orange scales (Tailwind's orange, Radix Orange)
- Use tools like Accessible Palette that use CIELAB/LCh

**Warning signs:**
- `coral-800` and `coral-900` look brownish, not coral-ish
- `coral-100` and `coral-200` are indistinguishable
- Scale feels "off" compared to other color families (gray, blue)
- Colors don't feel like they belong to same family
- Designers rejecting generated shades as "not right"

**Phase to address:** Phase 1 (Color system) - validate scale perceptually before finalizing

---

### Pitfall 10: One-to-One Color Swap Fallacy

**What goes wrong:** Replacing every instance of Raycast purple with coral. Some purples were semantic (error? info? selected?), not brand colors.

**Why it happens:**
- Assumption that "brand color" means "primary purple/blue"
- Missing context about color purpose in original design
- Mechanical find-replace approach
- No audit of how colors are actually used
- Original design may use brand color for multiple semantic purposes

**How to avoid:**
- Audit every color's semantic role before replacing
- Categorize: brand, semantic (success/error/warning/info), neutral, accent
- Only replace brand-role colors with coral
- Keep semantic colors (red for error, green for success) intact
- Document each color usage with its semantic meaning

**Warning signs:**
- Error states appearing in coral instead of red
- Success states appearing in coral instead of green
- Links appearing in coral (usually blue by convention)
- Information badges in coral (usually blue)
- Selected states using coral instead of appropriate highlight

**Phase to address:** Phase 1 (Color extraction) - semantic audit before any color replacement

---

### Pitfall 11: Accessibility Regression After Swap

**What goes wrong:** Original design passed accessibility. After coral swap, multiple contrast failures appear that weren't in original.

**Why it happens:**
- Original purple/blue had specific contrast ratios
- Coral has different luminosity profile
- Text/background combinations change contrast
- No systematic re-verification after swap
- Some swaps create new failing combinations

**How to avoid:**
- Document all contrast ratios in original design
- Map which combinations must maintain specific ratios
- Verify EVERY text/background combination after swap
- Create coral variants at specific contrast targets
- Use automated accessibility testing (axe, lighthouse)

**Warning signs:**
- axe/lighthouse errors appearing after swap
- Text that was readable becoming hard to read
- Interactive elements losing visual distinction
- Focus indicators becoming invisible
- Form labels failing contrast

**Phase to address:** Phase 1 (Color system) - build accessibility verification into swap process

---

## Token Organization Pitfalls

### Pitfall 12: Flat Token Structure

**What goes wrong:** All tokens at same level (`--coral`, `--spacing-4`, `--button-bg`). No hierarchy. Impossible to understand relationships.

**Why it happens:**
- Started simple, never restructured
- Different people added tokens without coordination
- No agreed-upon architecture
- Copied from tutorials that used flat structure
- Easier to add than to organize

**How to avoid:**
- Use three-tier architecture from day one:
  - **Primitive tokens:** Raw values (`--coral-500: #FF7F50`)
  - **Semantic tokens:** Purpose-based (`--color-primary: var(--coral-500)`)
  - **Component tokens:** Specific use (`--button-primary-bg: var(--color-primary)`)
- Document tier relationships
- Never use primitive tokens directly in components

**Warning signs:**
- Components referencing `--coral-500` directly
- Changing coral value doesn't update all coral uses
- No way to create themes
- Hundreds of tokens with no organization
- Can't answer "what uses this color?"

**Phase to address:** Phase 1 (Token architecture) - define hierarchy before extraction

---

### Pitfall 13: Special Characters in Token Names

**What goes wrong:** Token names with spaces, emojis, brackets, or special characters break code transforms or tooling.

**Why it happens:**
- Names copied from design tools that allow special chars
- Using curly brackets `{color}` to indicate references
- Spaces in compound names
- International characters
- Copy-paste from non-technical documentation

**How to avoid:**
- Use only `a-z`, `0-9`, `-` (hyphen) in token names
- Lowercase only (CSS custom properties are case-sensitive)
- Hyphens for word separation, not underscores (CSS convention)
- Test names through full toolchain before committing
- Validate names in CI pipeline

**Warning signs:**
- Build errors mentioning invalid identifiers
- Some tokens work, others don't
- Platform-specific failures (works on Mac, fails on Windows)
- JSON parse errors in token files
- CSS syntax errors in browser console

**Phase to address:** Phase 1 (Token architecture) - validate naming rules before extraction

---

### Pitfall 14: Typography Token Truncation

**What goes wrong:** Token names truncated in Figma/DevTools showing only first or last portion. Can't distinguish between tokens.

**Why it happens:**
- Token names too long
- Important differentiator at end of name
- Tool UI has fixed width
- Didn't test how names appear in actual use
- Category prefix takes up all visible space

**How to avoid:**
- Put differentiator early in name: `heading-xl` not `typography-heading-extra-large`
- Test token names in Figma, DevTools, IDE autocomplete
- Keep names under 30 characters when possible
- Use consistent abbreviations (xl, lg, md, sm, xs)
- Front-load unique identifiers

**Warning signs:**
- Tokens appearing identical in dropdowns
- Developers selecting wrong token because names look same
- Confusion between `button-primary-hover` and `button-primary-active`
- Having to expand panels to see full names
- IDE autocomplete showing duplicates

**Phase to address:** Phase 1 (Token architecture) - test names in target tools

---

## Documentation Pitfalls

### Pitfall 15: Documentation Written Once, Never Updated

**What goes wrong:** Docs become outdated within weeks. Team stops trusting docs and uses tribal knowledge instead.

**Why it happens:**
- Documentation is separate from code
- No process to update docs with code changes
- "Spare time" documentation never happens
- No ownership of documentation maintenance
- Docs built later, not alongside code

**How to avoid:**
- Co-locate documentation with code (Storybook, TSDoc, inline comments)
- Make documentation update part of PR requirements
- Add "Last updated" timestamps
- Use automated documentation where possible (generated from code)
- Assign documentation ownership

**Warning signs:**
- Developers saying "don't trust the docs, ask Jake"
- Documentation showing old screenshots
- Props in docs that don't exist in code
- Missing recently added components
- Timestamps months old

**Phase to address:** All phases - establish documentation-as-code pattern from start

---

### Pitfall 16: Documenting What, Not Why

**What goes wrong:** Documentation says "primary button is coral" but not "use primary button for main CTAs, max one per section." Developers misuse components.

**Why it happens:**
- Easy to document appearance
- Hard to document intent and constraints
- No user research on what developers need to know
- Copying reference site's docs without context
- Technical writers focus on technical accuracy

**How to avoid:**
- Include "when to use" and "when not to use" for every component
- Document constraints: "only one primary button per view"
- Show bad examples, not just good examples
- Write for the developer who doesn't know design systems
- Include accessibility requirements

**Warning signs:**
- Multiple primary buttons on same screen
- Components used for wrong purposes
- Developers asking "when should I use X vs Y?"
- Inconsistent patterns across different developers
- Repeated design review feedback on same issues

**Phase to address:** Phase 3 (Component development) - establish documentation template

---

## Verification Pitfalls

### Pitfall 17: Pixel-Perfect False Positives

**What goes wrong:** Visual regression tests fail on every run due to anti-aliasing, font rendering, or subpixel differences. Team ignores all failures.

**Why it happens:**
- Screenshot comparison is pixel-level
- Different machines render fonts differently
- Browser anti-aliasing varies
- Flaky tests erode trust
- No consistent rendering environment

**How to avoid:**
- Run visual tests in consistent Docker/CI environment
- Configure threshold for acceptable pixel differences (e.g., 0.1%)
- Use perceptual diff algorithms, not pixel-exact
- Separate flaky tests from reliable tests
- Use tools designed for design systems (Chromatic, Percy)

**Warning signs:**
- Visual tests fail but screenshots look identical
- Team approving changes without reviewing
- Different results locally vs CI
- "Just ignore that test, it always fails"
- Build times increasing from excessive baseline updates

**Phase to address:** Phase 3 (Verification setup) - tune comparison sensitivity

---

### Pitfall 18: Testing Components in Isolation Only

**What goes wrong:** Components pass tests in Storybook but break when combined. Spacing, z-index, and font cascading issues appear in real pages.

**Why it happens:**
- Storybook provides clean environment
- No inherited styles in isolation
- No competing z-indexes
- No parent layout constraints
- Component interactions not tested

**How to avoid:**
- Test components in Storybook AND in realistic page compositions
- Create "integration story" showing components together
- Test within parent layouts (sidebar, modal, card)
- Test cascading scenarios (button inside button-like card)
- Build page-level visual regression tests

**Warning signs:**
- "Works in Storybook but not in app"
- Z-index wars between components
- Font sizes different in context vs isolation
- Spacing collapses or doubles in composition
- Modal/overlay conflicts

**Phase to address:** Phase 3 (Testing strategy) - include composition tests

---

### Pitfall 19: Manual Verification Doesn't Scale

**What goes wrong:** Launch verification is manual checklist. Team burns out, starts skipping checks. Regressions slip through.

**Why it happens:**
- Automated verification seemed optional
- "We'll add it later"
- Each component adds to manual burden
- No tooling investment early
- Time pressure favors shipping over testing

**How to avoid:**
- Invest in visual regression testing from day one
- Automate accessibility checks (axe, lighthouse)
- Create automated token-to-CSS verification
- Build verification into CI pipeline
- Make passing automated checks required for merge

**Warning signs:**
- Verification checklist growing longer each sprint
- "We'll check it later" becoming common
- Bugs found in production that verification should catch
- Verification becoming bottleneck for releases
- Different team members running different checks

**Phase to address:** Phase 2 (Infrastructure) - automated verification before component work

---

## "Looks Done But Isn't" Checklist

Common items that get missed when a design system "looks complete":

### Colors
- [ ] All 9 shades of coral scale (100-900) generated
- [ ] Contrast ratios verified for all text/background combinations
- [ ] Dark mode equivalents for all colors
- [ ] Semantic color mappings (primary, secondary, destructive, success, warning, info)
- [ ] Opacity variants for overlays
- [ ] Color scale follows perceptually uniform progression
- [ ] Brown/muddy shades hand-tuned for orange family

### Typography
- [ ] All font weights actually loaded (not just defined)
- [ ] Line heights tested with multi-line content
- [ ] Letter spacing for all heading levels
- [ ] Font loading fallback defined (FOUT/FOIT strategy)
- [ ] Typography scale tested on mobile viewports
- [ ] Prose/body text styles for long-form content
- [ ] Code/monospace styles defined

### Spacing
- [ ] Consistent spacing scale (not arbitrary values)
- [ ] Negative spacing variants for overlap effects
- [ ] Component-specific spacing (button padding, card gaps)
- [ ] Spacing verified at all breakpoints
- [ ] Gap utilities for flex/grid layouts
- [ ] Spacing scale documented with use cases

### Components
- [ ] All interactive states (hover, focus, active, disabled)
- [ ] Loading states for async components
- [ ] Error states for form elements
- [ ] Empty states for lists/tables
- [ ] Keyboard navigation tested
- [ ] Screen reader announcements verified
- [ ] Focus trap for modals/dialogs
- [ ] Touch targets meet 44x44px minimum

### Documentation
- [ ] Token reference with all values
- [ ] Component API documentation
- [ ] Usage guidelines (when to use, when not to use)
- [ ] Copy-paste code examples
- [ ] Migration guide from previous system (if applicable)
- [ ] Accessibility requirements per component
- [ ] Do/Don't visual examples

### Integration
- [ ] Tailwind config matches token values exactly
- [ ] CSS custom properties exported
- [ ] TypeScript types for theme
- [ ] IDE autocomplete working for tokens
- [ ] Build size impact measured
- [ ] No unused tokens in bundle
- [ ] Purge/content configuration verified

---

## Pitfall-to-Phase Mapping

| Phase | Pitfalls to Address | Prevention Strategy |
|-------|---------------------|---------------------|
| **Phase 0: Setup** | None specific | Establish team alignment on approach |
| **Phase 1: Foundation** | Drift (#1), Computed styles (#2), Accessibility (#3), Naming collisions (#4), Missing states (#6), Semantic extraction (#7), Color scaling (#9), Color swap (#10), Accessibility regression (#11), Token hierarchy (#12), Special chars (#13), Token names (#14) | Establish governance, extraction protocol, naming conventions, token architecture, accessibility verification before any extraction |
| **Phase 2: Tailwind Config** | Dynamic classes (#5), CSS scope (#8), Manual verification (#19) | Document pattern constraints, set up automated verification, establish scope boundaries |
| **Phase 3: Components** | Isolation testing (#18), Documentation (#15, #16), Visual regression (#17) | Include composition tests, documentation-as-code, tune VRT thresholds, establish documentation templates |
| **All Phases** | Documentation drift (#15) | Documentation updates required in every PR |

---

## Research Gaps / Open Questions

1. **Raycast-specific patterns**: Need to analyze actual raycast.com to understand their specific color usage patterns and semantic structure

2. **Coral perceptual tuning**: May need manual adjustment of generated scale - automated generation of orange family tends toward brown in dark shades

3. **Verification tooling selection**: Need to evaluate Percy vs Chromatic vs BackstopJS for this specific use case

4. **Token format**: Should tokens be JSON, YAML, CSS custom properties native, or use W3C Design Tokens format?

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Design Drift | HIGH | Industry-wide problem, well-documented patterns |
| Extraction Accuracy | HIGH | Browser DevTools behavior is documented, CSS spec clear |
| Coral Accessibility | HIGH | WCAG requirements explicit, contrast ratios calculable |
| Token Naming | HIGH | CSS spec clear, tooling behavior documented |
| Tailwind Compilation | HIGH | Tailwind docs explicit about JIT behavior |
| Color Scaling | MEDIUM | Perceptual color science established, but coral-specific tuning needs validation |
| Documentation Patterns | HIGH | Industry best practices well-established |
| Verification Tooling | MEDIUM | Tools mature but project-specific tuning needed |

---

## Sources

### Design System Pitfalls (General)
- [Design Systems in 2026: Predictions, Pitfalls, and Power Moves](https://rydarashid.medium.com/design-systems-in-2026-predictions-pitfalls-and-power-moves-f401317f7563)
- [Design Systems Pitfalls - Jeff Pelletier](https://medium.com/@withinsight1/design-systems-pitfalls-6b3113fa0898)
- [9 Design System Traps to Avoid - Modus Create](https://moduscreate.com/blog/9-design-system-traps-to-avoid/)
- [How to Avoid 5 Common Design System Mistakes](https://www.goabstract.com/blog/avoid-design-system-mistakes)

### Token Naming and Organization
- [Naming Tokens in Design Systems - Nathan Curtis](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676)
- [Best Practices for Naming Design Tokens - Smashing Magazine](https://www.smashingmagazine.com/2024/05/naming-best-practices/)
- [Token Name Technical Specs - Tokens Studio](https://docs.tokens.studio/manage-tokens/token-names/technical-specs)
- [Naming - Nord Design System](https://nordhealth.design/naming/)

### Tailwind CSS Configuration
- [Don't use Tailwind for your Design System - Sancho.dev](https://sancho.dev/blog/tailwind-and-design-systems)
- [Troubleshooting Tailwind CSS - Mindful Chase](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/troubleshooting-tailwind-css-build-errors,-missing-styles,-and-configuration-pitfalls-in-front-end-projects.html)
- [Tailwind CSS Best Practices 2025-2026 - FrontendTools](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)
- [Top Tailwind CSS Common Mistakes - Helius Work](https://heliuswork.com/blogs/tailwind-css-common-mistakes/)

### Color Systems and Accessibility
- [Color in Design Systems - Nathan Curtis](https://medium.com/eightshapes-llc/color-in-design-systems-a1c80f65fa3)
- [WebAIM: Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Using Color - USWDS](https://designsystem.digital.gov/design-tokens/color/overview/)
- [Accessible Palette](https://accessiblepalette.com/)
- [InclusiveColors: WCAG Accessible Color Palette Creator](https://www.inclusivecolors.com/)

### Visual Regression Testing
- [Top 7 Visual Testing Tools for 2026 - testRigor](https://testrigor.com/blog/visual-testing-tools/)
- [Visual Regression Testing: Comparing SaaS and DIY Tools - Sparkbox](https://sparkbox.com/foundry/visual_regression_testing_with_backstopjs_applitools_webdriverio_wraith_percy_chromatic)
- [Visual Regression Testing Best Practices - Medium](https://medium.com/@ss-tech/the-ui-visual-regression-testing-best-practices-playbook-dc27db61ebe0)

### CSS Extraction
- [How to Reverse Engineer a Website - freeCodeCamp](https://www.freecodecamp.org/news/how-to-reverse-engineer-a-website/)
- [CSS Features Reference - Chrome DevTools](https://developer.chrome.com/docs/devtools/css/reference)
- [Be Aware of Using CSS Custom Properties - Nucleus Design System](https://blog.nucleus.design/be-aware-of-css-custom-properties/)
- [How Custom Property Values are Computed - Modern CSS](https://moderncss.dev/how-custom-property-values-are-computed/)
- [Computed Values: More Than Meets the Eye - CSS-Tricks](https://css-tricks.com/computed-values-more-than-meets-the-eye/)

### Documentation and Maintenance
- [Maintaining Design Systems - Brad Frost](https://atomicdesign.bradfrost.com/chapter-5/)
- [Tips for Design System Documentation - LogRocket](https://blog.logrocket.com/ux-design/design-system-documentation/)
- [Design System Maintenance Checklist - UXPin](https://www.uxpin.com/studio/blog/design-system-maintenance-checklist/)
- [Methods and Techniques for Design System Maintenance - LogRocket](https://blog.logrocket.com/ux-design/methods-techniques-design-system-maintenance/)

### Figma-to-Code Sync
- [From Figma to Production: How I Finally Synced My Design System](https://medium.com/@alexdev82/from-figma-to-production-how-i-finally-synced-my-design-system-and-stopped-going-mad-30ff78b93eb3)
- [The Right Code for Your Design System - Figma Blog](https://www.figma.com/blog/introducing-code-connect/)
- [Figma to Frontend: Synchronizing Design and Code Automatically - VK Team](https://vkteam.medium.com/figma-to-frontend-synchronizing-design-and-code-automatically-62e493054631)
