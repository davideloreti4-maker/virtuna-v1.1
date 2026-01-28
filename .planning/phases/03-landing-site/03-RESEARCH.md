# Phase 3: Landing Site - Research Findings

**Question**: What do I need to know to PLAN this phase well?

---

## 1. Section Breakdown (societies.io Homepage)

The homepage consists of these sections in order (from top to bottom):

| Section | Description | Complexity |
|---------|-------------|------------|
| **Header/Nav** | Sticky nav with logo, "Sign in", "Book a Meeting" CTA | Low - exists (needs update) |
| **Hero** | Two-column: text left, 3D network right, persona card | High - 3D viz is complex |
| **Backers** | "Backed by" + "With Investors from" logo rows | Medium - SVG logos needed |
| **Features** | "Into the future" header + 2x2 feature cards | Medium |
| **Stats/Accuracy** | 86% stat + comparison chart | Medium |
| **Case Study (Teneo)** | Two-column: card left, quote right | Medium |
| **Partnership (Pulsar)** | Two-column: quote left, card right | Medium |
| **FAQ** | Accordion with 7 questions | Medium - needs component |
| **CTA + Footer** | Final CTA + footer links/socials | Low |

**Total sections**: 9 distinct sections

---

## 2. Existing Infrastructure

### Components Already Built
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| `Header` | `/src/components/layout/header.tsx` | Needs update | Has landing/app variants, needs societies.io styling |
| `Footer` | `/src/components/layout/footer.tsx` | Needs update | Has minimal prop, needs societies.io CTA/footer combo |
| `Container` | `/src/components/layout/container.tsx` | Ready | Has default/narrow/wide sizes |
| `Button` | `/src/components/ui/button.tsx` | Ready | Has primary/secondary/ghost/link variants |
| `Card` | `/src/components/ui/card.tsx` | Ready | Basic card with header/content/footer |
| `FadeIn` | `/src/components/motion/fade-in.tsx` | Ready | Scroll-triggered opacity + translateY |
| `SlideUp` | `/src/components/motion/slide-up.tsx` | Ready | Scroll-triggered larger translateY |
| `PageTransition` | `/src/components/motion/page-transition.tsx` | Ready | Route transitions |

### Design Tokens (globals.css)
```css
--color-background: #0D0D0D;
--color-background-elevated: #1A1A1A;
--color-foreground: #FFFFFF;
--color-foreground-secondary: #F5F5F5;
--color-foreground-muted: #CCCCCC;
--color-accent: #E57850;
--color-border: rgba(255, 255, 255, 0.1);

--font-display: var(--font-funnel-display);
--font-sans: var(--font-satoshi);

--text-hero: 52px;
--text-section: 40px;
--text-card-title: 18px;

--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
```

### Dependencies Available
- `@phosphor-icons/react` - Already installed for icons
- `motion` (Framer Motion v12) - Already installed for animations
- `@radix-ui/react-slot` - For polymorphic components
- `class-variance-authority` - For variant management

---

## 3. Assets Inventory

### Already Downloaded (`/public/images/landing/`)
- `logo.png` - Site logo
- `teneo-logo-dark-jwgUPXrf.png` - Teneo case study logo
- `teneo-logo-light-DLRv00GF.png` - Teneo light variant
- `sparky_zivin-B2KuZ-Xx.jpeg` - Teneo testimonial person
- `DC_dark-CPn4aTvq.png`, `GP_dark-Dy1ua8xD.png`, `TE_dark-DMnXWuUZ.png` - Partner/investor logos

### Assets Still Needed
| Asset | Source | Priority |
|-------|--------|----------|
| Pulsar logo | Download from societies.io | High |
| Point72 Ventures logo | SVG/download | High |
| Kindred Capital logo | SVG/download | High |
| Y Combinator logo | SVG/download | High |
| Investor logos (Sequoia, Google, DeepMind, Prolific, Strava) | SVG/download | High |
| Quote marks icon | SVG or Phosphor | Medium |
| 3D Network visualization placeholder | Create static image or skip | Medium |

### Icon Requirements (Phosphor Icons)
- `Crosshair` - Unreachable audiences
- `Lightning` - Instant insights
- `UsersThree` - Millions of personas
- `Brain` - True understanding
- `CaretDown` - FAQ accordion
- `ArrowRight` - "Read more" links
- `LinkedinLogo` - Social
- `XLogo` - Social
- `Envelope` - Email social
- `MapPin`, `GenderMale`, `GenderFemale` - Persona card (if implemented)

---

## 4. Typography Specifications

### Hero
- **Heading**: Funnel Display, 52px, weight 350, line-height 62.4px
- **Orange accent**: `#E57850` (--color-accent)
- **Subtext**: Satoshi, 20px, weight 450, line-height 30px

### Section Headers
- **Label** (e.g., "Into the future"): Satoshi, 14px, #F5F5F5
- **Heading** (H2): Funnel Display, 40px, weight 350, line-height 44px

### Card Content
- **Title** (H3): Funnel Display, 18px, weight 500, line-height 27px
- **Description**: Satoshi, 16px, line-height 24px, #CCCCCC

### Buttons
- **Primary**: bg-accent, white text, 14px medium, px-4 py-2, rounded-sm (4px)
- **Secondary/Ghost**: transparent bg, border white/20, white text

---

## 5. Layout Specifications

### Container Widths
- Primary content: `max-w-6xl` (1152px) - matches reference
- Narrow sections (FAQ): `max-w-3xl` (768px)
- Footer CTA: `max-w-4xl` (896px)

### Grid Patterns
- Features: 2x2 grid (`grid-cols-2 gap-6`) on desktop, stack on mobile
- Case Study/Partnership: 2-column (`grid-cols-2 gap-8`)
- Backers: flex row with gap-8 (main), gap-6 (investors)

### Spacing
- Section padding: `py-24` (96px vertical)
- Card padding: `p-8` (32px) or `p-6` (24px)
- Between sections: natural flow with `py-24` stacking

---

## 6. Animation Requirements

### Existing Motion Components
- `FadeIn`: opacity 0→1, translateY 20px→0, ease-out-cubic, viewport once
- `SlideUp`: opacity 0→1, translateY 60px→0, ease-out-quart, viewport once

### Needed Enhancements
| Animation | Reference Behavior | Implementation |
|-----------|-------------------|----------------|
| Staggered fade-in | Children animate sequentially | Add stagger variant to FadeIn |
| FAQ expand/collapse | Height 0→auto, chevron rotation | Radix Accordion or custom |
| Header scroll | Sticky with backdrop blur | Already exists |
| Parallax (if any) | Inspect societies.io | May not be needed |

### Reduced Motion
- Both FadeIn and SlideUp already handle `prefers-reduced-motion` via `useReducedMotion()`

---

## 7. Navigation & Routing

### Header Updates Needed
- Logo: Update to societies.io style logo (icon + "Artificial Societies" text)
- Nav links: Remove nav links (societies.io has none on landing)
- CTAs: "Sign in" (ghost) + "Book a Meeting" (primary)
- Mobile: Simpler - just CTAs

### Unbuilt Pages (redirect to /coming-soon)
- `/privacy-notice`
- `/terms-of-service`
- `/subprocessors`
- `/case-studies/teneo` (or build placeholder)
- Any other linked pages

### External Links
- LinkedIn: `https://www.linkedin.com/company/artificial-societies`
- X: `https://x.com/societiesio`
- Email: `mailto:founders@societies.io`
- Evaluation PDF: `https://storage.googleapis.com/as-website-assets/...`

---

## 8. Component Architecture Plan

### New Components Needed
```
src/components/
  landing/
    hero-section.tsx          # Hero with text + placeholder for 3D
    persona-card.tsx          # Floating persona preview (optional)
    backers-section.tsx       # Logo rows
    features-section.tsx      # 2x2 feature grid
    feature-card.tsx          # Individual feature card
    stats-section.tsx         # 86% accuracy comparison
    comparison-chart.tsx      # Model accuracy bars
    case-study-section.tsx    # Teneo section
    partnership-section.tsx   # Pulsar section
    testimonial-quote.tsx     # Reusable quote component
    faq-section.tsx           # FAQ accordion wrapper
    faq-item.tsx              # Individual accordion item
    cta-section.tsx           # Final CTA
    landing-footer.tsx        # Custom footer for landing
  ui/
    accordion.tsx             # For FAQ (or use Radix directly)
```

### Updated Components
- `Header` - Update for societies.io landing style
- `Footer` - May need landing-specific variant or new component

---

## 9. Responsive Breakpoints

From reference inspection:

| Breakpoint | Behavior |
|------------|----------|
| Desktop (1280px+) | Full 2-column layouts, all elements visible |
| Tablet (768px-1279px) | Features may stay 2-col, case studies stack |
| Mobile (<768px) | Single column, stacked layouts, hamburger menu |

### Key Responsive Changes
- Hero: Stack text/visual vertically on mobile
- Features: 1-column on mobile
- Case Study/Partnership: Stack vertically
- Footer: Stack into multiple rows

---

## 10. Key Decisions & Unknowns

### Confirmed (from CONTEXT.md)
- **Exact pixel match** required - inspect societies.io for precise values
- **Dark mode only** - no theme toggle on landing
- **Download actual assets** from societies.io
- **Unbuilt pages → /coming-soon**
- **v0 MCP for UI design accuracy** - use for complex sections

### Open Questions
| Question | Recommendation |
|----------|----------------|
| 3D Network visualization | Use static placeholder image - complex node animation is out of scope per PROJECT.md |
| Persona card on hero | Implement as static card - animation optional |
| FAQ answer content | May need to inspect societies.io or use placeholder text |
| Animation replay on scroll-up | Check societies.io behavior |
| Exact padding/margins | Use browser dev tools inspection |

---

## 11. Implementation Order Recommendation

### Wave 1: Foundation (can parallelize)
1. Update Header component for societies.io landing style
2. Create `/coming-soon` page
3. Download/organize remaining assets
4. Create Accordion component for FAQ

### Wave 2: Sections (sequential, top to bottom)
1. Hero section (text content only, placeholder for 3D)
2. Backers section
3. Features section

### Wave 3: Middle Sections
1. Stats/Accuracy section with comparison chart
2. Case Study (Teneo) section
3. Partnership (Pulsar) section

### Wave 4: Bottom Sections
1. FAQ section
2. CTA + Footer section

### Wave 5: Polish
1. Mobile responsive adjustments
2. Animation fine-tuning (stagger, timings)
3. Visual QA against reference

---

## 12. Risk Assessment

| Risk | Mitigation |
|------|------------|
| 3D visualization complexity | Use static placeholder - explicitly out of scope |
| Pixel-perfect matching | Use browser dev tools, v0 MCP, frequent screenshot comparisons |
| Missing assets | Download from societies.io or recreate |
| Animation timing mismatch | Inspect societies.io dev tools for exact values |
| Mobile layout differences | Dedicated mobile testing pass |

---

## 13. Files to Reference During Implementation

### Reference Documentation
- `.reference/landing/hero.md` - Hero section specs
- `.reference/landing/features.md` - Features grid specs
- `.reference/landing/testimonials.md` - Case study and quotes
- `.reference/landing/backers.md` - Investor logos
- `.reference/landing/stats.md` - 86% accuracy section
- `.reference/landing/faq.md` - FAQ questions and accordion
- `.reference/landing/cta.md` - Final CTA and footer
- `.reference/landing/_assets/icons.md` - Icon specifications

### Reference Screenshots
- `.reference/landing/_assets/hero-viewport.png`
- `.reference/landing/_assets/features-viewport.png`
- `.reference/landing/_assets/testimonials-viewport.png`
- `.reference/landing/_assets/faq-viewport.png`
- `.reference/landing/_assets/footer-viewport.png`
- `.reference/landing/_assets/landing-full-dark.png`

---

## Summary

Phase 3 involves building **9 distinct sections** for the landing page with **pixel-perfect accuracy**. The existing infrastructure provides:
- Animation primitives (FadeIn, SlideUp)
- Design tokens (colors, fonts, spacing)
- Base UI components (Button, Card, Container)
- Header/Footer foundations to update

Key work items:
1. **Asset collection** - Download remaining logos/images
2. **New components** - ~12 landing section components
3. **Component updates** - Header and Footer for landing
4. **Accordion component** - For FAQ section
5. **Responsive implementation** - All breakpoints
6. **Animation polish** - Stagger effects, timing matching

The 3D network visualization should be replaced with a **static placeholder image** per the project scope (complex node animations are out of scope).
