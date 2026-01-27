---
# Summary Frontmatter
phase: "03-landing-site"
plan: "01"
subsystem: "navigation"
tags: ["navigation", "header", "footer", "mobile-menu", "assets", "design-tokens"]

# Dependency Graph
requires: ["02-design-system-components"]
provides: ["navigation-components", "design-tokens", "landing-assets"]
affects: ["03-02", "03-03", "03-04"]

# Tech Tracking
tech-stack:
  added: []
  patterns:
    - "hide-on-scroll-down sticky header with motion/react"
    - "AnimatePresence for mobile menu slide-in animation"
    - "centralized navigation constants for header/footer"

# File Tracking
key-files:
  created:
    - "public/images/landing/* (11 image assets)"
    - "public/fonts/Satoshi-Variable.woff2"
    - "src/lib/constants/design-tokens.ts"
    - "src/lib/constants/navigation.ts"
    - "src/components/layout/mobile-menu.tsx"
  modified:
    - "src/components/layout/header.tsx"
    - "src/components/layout/footer.tsx"
    - "src/app/globals.css"

# Decisions
decisions:
  - id: "satoshi-font"
    choice: "Use Satoshi Variable font from societies.io"
    context: "societies.io uses Satoshi for body text, Funnel Display for h1"
  - id: "navigation-structure"
    choice: "Centralized navigation constants in src/lib/constants/navigation.ts"
    context: "DRY principle - header and footer both consume same nav data"
  - id: "mobile-menu-pattern"
    choice: "Slide-in from right with AnimatePresence and body scroll lock"
    context: "Matches common mobile menu UX patterns"
  - id: "header-scroll-behavior"
    choice: "Hide on scroll down, show on scroll up using useScroll/useMotionValueEvent"
    context: "Per RESEARCH.md Pattern 3, maximizes content space on scroll"

# Metrics
metrics:
  duration: "~15 minutes"
  completed: "2026-01-27"
---

# Phase 3 Plan 1: Landing Foundation Summary

Downloaded societies.io assets and created pixel-perfect navigation components with sticky header behavior and animated mobile menu.

## What Was Built

### Task 1: Asset Download and Design Token Extraction

Downloaded 11 image assets from societies.io:
- Logo (logo.png)
- Social card (social-card.png)
- Partner logos (DC, GP, TE in dark/light variants)
- Teneo logos (dark/light)
- Team photo (sparky_zivin)

Downloaded Satoshi Variable font (woff2) for body text typography.

Created design-tokens.ts documenting:
- Color palette (#0d0d0d background, #E57850 accent)
- Typography (Satoshi body, Funnel Display headings)
- Spacing values (container max-width, section padding)
- Animation easing curves (12 cubic-bezier definitions from societies.io CSS)
- Z-index scale for layering

Updated globals.css with:
- Satoshi font-face declaration
- Font family variables (--font-sans, --font-display)
- societies.io easing curve variables
- h1/h2 font family rules

### Task 2: Navigation Components

Created navigation.ts with:
- headerNavItems array (Resources dropdown with Documentation, Research Report)
- headerCTA object (Sign in, Book a Meeting)
- footerLinks array (Legal section: Privacy Notice, Terms of Service, Subprocessors)
- socialLinks array (LinkedIn, X/Twitter)
- footerContact object (email, copyright text)

Updated Header component:
- Converted to client component for scroll behavior
- Implemented hide-on-scroll-down, show-on-scroll-up using useScroll/useMotionValueEvent
- Added dropdown menu support for nav items with children
- Integrated MobileMenu with hamburger button (hidden on desktop)
- Uses logo.png instead of text lambda

Created MobileMenu component:
- Slide-in from right animation with AnimatePresence
- Backdrop overlay with opacity transition
- Body scroll lock when open
- Close button and navigation items
- CTA buttons at bottom

Updated Footer component:
- Simplified to match societies.io minimalist footer
- Brand column with logo, tagline, and contact email
- Legal links column
- Connect column with social links
- Copyright at bottom

## Technical Details

### Scroll Behavior Implementation

```typescript
const [hidden, setHidden] = useState(false)
const { scrollY } = useScroll()

useMotionValueEvent(scrollY, "change", (latest) => {
  const previous = scrollY.getPrevious() ?? 0
  if (latest > previous && latest > 150) {
    setHidden(true)
  } else {
    setHidden(false)
  }
})
```

### Mobile Menu Animation

```typescript
<motion.nav
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
>
```

### Key Design Values

| Property | Value |
|----------|-------|
| Header height | 60px |
| Background | #0d0d0d |
| Accent color | #E57850 |
| Text color | #ffffff |
| Muted text | #9CA3AF |
| Border | #262626 |
| Font (body) | Satoshi |
| Font (display) | Funnel Display |

## Verification Results

- [x] /public/images/landing/ contains 11+ image files
- [x] src/lib/constants/design-tokens.ts exists with documented values
- [x] src/app/globals.css updated with Satoshi font and easing curves
- [x] npm run build succeeds
- [x] Header renders with nav items from navigation.ts
- [x] Header uses useScroll/useMotionValueEvent for hide/show behavior
- [x] MobileMenu uses AnimatePresence for enter/exit animation
- [x] Footer renders with links from navigation.ts

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 03-02 (Homepage):
- Navigation components ready to use
- Design tokens documented for consistent styling
- Assets available in /public/images/landing/
- Easing curves available as CSS variables

No blockers or concerns.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 971b26f | feat | Download assets and extract design tokens from societies.io |
| 8d47025 | feat | Create navigation constants and update Header/Footer |
