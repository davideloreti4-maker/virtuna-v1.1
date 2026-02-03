# Stack Research: Design System Extraction & Implementation

**Domain:** Design System Extraction & Tailwind v4 Token Configuration
**Researched:** 2026-02-03
**Confidence:** HIGH

---

## Executive Summary

The project already has a comprehensive Tailwind v4 design token foundation in `globals.css`. This research focuses on **tooling to systematically extract additional values from raycast.com** and **patterns for organizing/extending the existing token system** as the design system matures.

**Key findings:**
1. **Tailwind v4 is already properly configured** with `@theme` directive and comprehensive namespaces
2. **Extraction tools exist at multiple levels** - from CLI (Dembrandt) to desktop apps (Superposition) to browser extensions
3. **Style Dictionary** is the industry standard for token transformation when Figma integration is needed
4. **Storybook + Chromatic** is the recommended documentation/testing combo for design systems

---

## Current State Analysis

The project already has Tailwind v4 configured with design tokens in `/src/app/globals.css`:

| Token Category | Count | Status |
|----------------|-------|--------|
| Color - Background | 10+ | Complete |
| Color - Foreground | 4 | Complete |
| Color - Grey scale | 10 | Complete |
| Color - Accents | 8 | Complete |
| Color - State | 8 | Complete |
| Color - Border | 6 | Complete |
| Typography | 15+ | Complete |
| Spacing | 14 | Complete |
| Border radius | 10 | Complete |
| Shadows | 15+ | Complete |
| Animations | 10+ | Complete |
| Gradients | 6 | Complete |

**Verdict:** The foundation is solid. What's needed is tooling for:
1. Validating extraction accuracy against source
2. Capturing additional values as discovered
3. Documenting the system for team use
4. Exporting to Figma for designer handoff

---

## Recommended Stack

### 1. Extraction Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| **Dembrandt** | latest | CLI extraction from any URL | Bulk extraction, initial audits, CI verification |
| **Superposition** | latest | Desktop app extraction + export | Interactive exploration, Figma export |
| **Chrome DevTools** | built-in | Manual inspection | Edge cases, computed styles, interaction states |
| **Playwright** | 1.58.0 (existing) | Automated screenshot capture | Already configured in `/extraction/` |

#### Dembrandt (Recommended for Bulk Extraction)

```bash
# Install globally
npm install -g dembrandt

# Extract raycast.com design system
npx dembrandt raycast.com --dtcg --save-output

# Extract dark mode variant
npx dembrandt raycast.com --dark-mode --dtcg

# Output in W3C Design Tokens format (DTCG)
npx dembrandt raycast.com --dtcg
```

**What it extracts:**
- Colors (semantic palettes, CSS variables)
- Typography (fonts, sizes, weights)
- Spacing (margin/padding scales)
- Borders (radius, widths, styles)
- Shadows
- Breakpoints

**Output format:** W3C Design Tokens Community Group (DTCG) JSON, compatible with Style Dictionary.

**Why Dembrandt:**
- Single command extraction
- DTCG format works with Style Dictionary pipeline
- Confidence-scored tokens (helps identify noise)
- Works with bot-protected sites (Playwright under the hood)

#### Superposition (Recommended for Interactive Exploration)

Download from [superposition.design](https://superposition.design/) (macOS, Windows, Linux)

**Workflow:**
1. Point at raycast.com
2. Review extracted tokens grouped by category
3. Copy CSS values directly
4. Export to CSS, SCSS, JavaScript, or Figma

**Best for:** Interactive exploration, quick verification, designer collaboration.

#### Chrome DevTools Strategy

For computed styles and interaction states that automated tools miss:

1. **Elements > Computed** - See final computed values
2. **Elements > Styles** - See CSS variable definitions
3. **DevTools Suite extension** - Enhanced color picking, CSS inspection
4. **Copy as CSS** - Right-click any element for styles

**Extract these manually:**
- `:hover` state colors/shadows
- `:focus` ring styles
- `:active` pressed states
- Transition timing functions
- Transform origins

### 2. Design Token Management

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| **Tailwind v4 @theme** | 4.x (existing) | Token-to-utility mapping | HIGH |
| **Style Dictionary** | 4.x | Token transformation pipeline | HIGH |
| **Tokens Studio** | latest | Figma-to-code sync | HIGH |

#### Tailwind v4 @theme (Already Configured)

The project correctly uses `@theme` for design tokens. Key patterns to maintain:

```css
@import "tailwindcss";

@theme {
  /* Namespace-based organization */
  --color-*: ...;    /* Generates bg-*, text-*, border-* utilities */
  --spacing-*: ...;  /* Generates p-*, m-*, gap-* utilities */
  --radius-*: ...;   /* Generates rounded-* utilities */
  --shadow-*: ...;   /* Generates shadow-* utilities */
  --font-*: ...;     /* Generates font-* utilities */
  --text-*: ...;     /* Generates text-* (size) utilities */
}
```

**Best practices already followed:**
- Semantic naming (`--color-accent`, `--color-error`)
- Scale-based values (`--spacing-1` through `--spacing-13`)
- Raycast-exact extraction comments
- CSS variable fallbacks

**Patterns to add for theming:**

```css
/* For future light mode support */
@theme static {
  --color-background: var(--color-bg-dark);
  --color-foreground: var(--color-fg-dark);
}

/* Or use :root for runtime theming */
:root {
  --theme-mode: dark;
}
```

#### Style Dictionary (For Advanced Token Pipeline)

Use when you need to transform tokens to multiple formats (CSS, SCSS, iOS, Android, Figma).

```bash
npm install -D style-dictionary
```

**Configuration (`style-dictionary.config.json`):**

```json
{
  "source": [".tokens/**/*.json"],
  "platforms": {
    "css": {
      "transformGroup": "css",
      "buildPath": "src/styles/",
      "files": [{
        "destination": "tokens.css",
        "format": "css/variables",
        "options": {
          "outputReferences": true
        }
      }]
    },
    "figma": {
      "transformGroup": "web",
      "buildPath": "figma/",
      "files": [{
        "destination": "tokens.json",
        "format": "json"
      }]
    }
  }
}
```

**Token file structure (`.tokens/`):**

```
.tokens/
  color/
    background.json
    foreground.json
    accent.json
    state.json
  typography/
    font.json
    size.json
    weight.json
  spacing/
    scale.json
  radius/
    scale.json
  shadow/
    elevation.json
    glow.json
```

**When to use Style Dictionary:**
- Multiple output targets (CSS + Figma + native apps)
- Token aliasing/references needed
- CI/CD token validation
- Designer-developer sync workflow

**When NOT to use:**
- Single output target (Tailwind only) - `@theme` is sufficient
- No Figma handoff needed
- Small team without formal design ops

### 3. Documentation Tools

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| **Storybook** | 8.x | Component documentation | HIGH |
| **Chromatic** | SaaS | Visual regression testing | HIGH |
| **@storybook/addon-docs** | 8.x | Auto-generated docs | HIGH |

#### Storybook 8 (Recommended)

```bash
# Initialize in existing Next.js project
npx storybook@latest init
```

**Key addons for design systems:**

```bash
# Core documentation
npm install -D @storybook/addon-docs

# Design tokens visualization
npm install -D @storybook/addon-designs

# Accessibility testing
npm install -D @storybook/addon-a11y

# Responsive testing
npm install -D @storybook/addon-viewport
```

**Design system documentation structure:**

```
src/stories/
  foundations/
    Colors.stories.tsx
    Typography.stories.tsx
    Spacing.stories.tsx
    Shadows.stories.tsx
  components/
    Button.stories.tsx
    Card.stories.tsx
    ...
```

**Token documentation story:**

```tsx
// src/stories/foundations/Colors.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';

const ColorSwatch = ({ name, value }: { name: string; value: string }) => (
  <div className="flex items-center gap-3">
    <div
      className="w-12 h-12 rounded-md border border-border"
      style={{ backgroundColor: `var(${value})` }}
    />
    <div>
      <div className="font-mono text-sm">{name}</div>
      <div className="text-fg-300 text-xs">{value}</div>
    </div>
  </div>
);

const meta: Meta = {
  title: 'Foundations/Colors',
  parameters: {
    docs: {
      description: {
        component: 'Raycast-extracted color system with Virtuna coral accent.',
      },
    },
  },
};

export default meta;

export const Background: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <ColorSwatch name="background" value="--color-background" />
      <ColorSwatch name="bg-100" value="--color-bg-100" />
      <ColorSwatch name="bg-200" value="--color-bg-200" />
      <ColorSwatch name="bg-300" value="--color-bg-300" />
    </div>
  ),
};
```

#### Chromatic (Visual Regression)

```bash
# Install addon
npx storybook add chromatic
```

**Features relevant to design systems:**
- Catches unintended visual changes across all components
- Shared workspace for designer review
- Automatic baselines per branch
- Runs in CI (GitHub Actions, etc.)

**When to add:** After Storybook is populated with component stories. Not needed during initial extraction phase.

### 4. Figma Integration

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Tokens Studio for Figma** | Figma plugin for token management | Bi-directional sync |
| **Superposition Figma export** | One-way export to Figma | Quick designer handoff |
| **Style Dictionary Figma format** | Token transformation | CI/CD pipeline |

#### Tokens Studio Workflow

1. **Install** Figma plugin "Tokens Studio for Figma"
2. **Configure sync** with GitHub repo (`.tokens/` directory)
3. **Designer updates** tokens in Figma -> pushes to branch
4. **Developer reviews** PR -> merges
5. **Style Dictionary** transforms to CSS
6. **Tailwind picks up** new values

**Sync provider setup:**
- GitHub (recommended)
- GitLab
- Azure DevOps
- Bitbucket

**W3C Design Tokens format** is now standardized (October 2025), ensuring compatibility.

---

## Installation Commands

### Core (Already Installed)
```bash
# Tailwind v4 - already in package.json
# @tailwindcss/postcss: ^4
# tailwindcss: ^4
```

### Extraction Tools
```bash
# Dembrandt - CLI extraction
npm install -g dembrandt

# Superposition - Desktop app (download from website)
# https://superposition.design/
```

### Token Pipeline (Optional - for Figma sync)
```bash
npm install -D style-dictionary
npm install -D @tokens-studio/sd-transforms  # For Tokens Studio compatibility
```

### Documentation
```bash
# Storybook 8
npx storybook@latest init

# Core addons
npm install -D @storybook/addon-docs @storybook/addon-a11y @storybook/addon-viewport
```

### Visual Testing (Add Later)
```bash
# Chromatic - after Storybook is populated
npx storybook add chromatic
```

---

## CSS Variable Naming Conventions

The project follows a semantic + scale hybrid approach. Recommended patterns:

### Semantic Layer (What it means)
```css
--color-background      /* Page background */
--color-foreground      /* Primary text */
--color-accent          /* Brand/CTA color */
--color-error           /* Error states */
--color-success         /* Success states */
--color-border          /* Default borders */
```

### Scale Layer (How much)
```css
--color-bg-100          /* Lighter background */
--color-bg-200          /* Medium background */
--color-fg-200          /* Secondary text */
--spacing-1             /* 8px */
--spacing-2             /* 16px */
--radius-sm             /* 6px */
--radius-md             /* 8px */
```

### Component Layer (Where it's used)
```css
--color-button-bg       /* Button background */
--color-button-fg       /* Button text */
--navbar-height         /* Navbar specific */
```

**Naming rules:**
1. Use kebab-case (Tailwind v4 convention)
2. Namespace prefix matches Tailwind utility (`--color-*`, `--spacing-*`)
3. Semantic names for frequently-referenced tokens
4. Scale suffixes for progressive values (100, 200, 300 or sm, md, lg)
5. Component prefix for component-specific overrides

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Extraction CLI | Dembrandt | None comparable | Only tool with DTCG output + confidence scoring |
| Extraction Desktop | Superposition | Figma Dev Mode | Superposition exports to more formats |
| Token Transform | Style Dictionary | Token Transformer | Style Dictionary is more mature, better documented |
| Documentation | Storybook 8 | Docusaurus, custom | Storybook is purpose-built for components |
| Visual Testing | Chromatic | Percy, Playwright snapshots | Chromatic integrates natively with Storybook |
| Figma Sync | Tokens Studio | Figma Variables API | Tokens Studio handles transformation |

---

## What NOT to Use

| Tool/Approach | Reason |
|---------------|--------|
| **Manual CSS-to-Figma copy** | Error-prone, doesn't scale, no version control |
| **Tailwind v3 patterns** | v4 uses `@theme`, not `tailwind.config.js` for tokens |
| **tailwind.config.js for tokens** | v4 prefers CSS-first `@theme` approach |
| **Multiple token sources** | Single source of truth (Tailwind or Tokens Studio, not both) |
| **Complex theming before MVP** | YAGNI - add light mode only when needed |
| **Storybook 7** | v8 has better React 19 support, faster builds |
| **Custom documentation site** | Storybook is industry standard, well-maintained |

---

## Integration with Existing Stack

### Already Compatible

| Existing | Integration |
|----------|-------------|
| Next.js 16 | Storybook 8 supports App Router |
| React 19 | Storybook 8 has React 19 support |
| Tailwind v4 | `@theme` already configured correctly |
| Playwright | Existing `/extraction/` setup for screenshots |

### New Patterns Required

| Pattern | Location | Purpose |
|---------|----------|---------|
| Token documentation stories | `src/stories/foundations/` | Document design system |
| Component stories | `src/stories/components/` | Document components |
| `.tokens/` directory | Root (optional) | Style Dictionary source |
| Storybook config | `.storybook/` | Storybook configuration |

### Existing Extraction Infrastructure

The project already has Playwright-based extraction in `/extraction/`:
- `extraction/screenshots/` - 207 captured screenshots
- `extraction/scripts/` - Capture automation
- `extraction/tests/` - Playwright tests

**Recommendation:** Use existing Playwright setup for:
- Capturing interaction states (hover, focus, active)
- Validating extracted values match source
- Regression testing after design changes

---

## Workflow Recommendation

### Phase 1: Validate Existing Tokens (Now)
1. Run Dembrandt on raycast.com
2. Compare DTCG output against `globals.css`
3. Document any missing values
4. Update `globals.css` with gaps

### Phase 2: Add Storybook (After Components Exist)
1. Initialize Storybook
2. Create foundation stories (Colors, Typography, Spacing)
3. Add component stories as components are built
4. Configure addons (a11y, viewport)

### Phase 3: Figma Sync (If Designer Handoff Needed)
1. Install Tokens Studio in Figma
2. Configure GitHub sync
3. Set up Style Dictionary pipeline
4. Establish push/pull workflow

### Phase 4: Visual Regression (Production)
1. Add Chromatic
2. Configure CI integration
3. Set up review workflow

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Tailwind v4 @theme | HIGH | Official docs verified, already working in project |
| Dembrandt | HIGH | GitHub active, DTCG output verified |
| Superposition | HIGH | Desktop app verified, export formats confirmed |
| Style Dictionary | HIGH | Industry standard, extensive documentation |
| Storybook 8 | HIGH | Official docs verified, React 19 support confirmed |
| Chromatic | HIGH | Made by Storybook team, well-documented |
| Tokens Studio | HIGH | 264K Figma users, W3C DTCG compatible |
| Existing extraction setup | HIGH | Already configured and working in `/extraction/` |

---

## Sources

### Tailwind v4
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Theme Variables Documentation](https://tailwindcss.com/docs/theme)
- [Functions and Directives](https://tailwindcss.com/docs/functions-and-directives)

### Extraction Tools
- [Dembrandt GitHub](https://github.com/dembrandt/dembrandt)
- [Superposition](https://superposition.design/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools)

### Token Management
- [Style Dictionary Formats](https://styledictionary.com/reference/hooks/formats/)
- [Style Dictionary GitHub](https://github.com/style-dictionary/style-dictionary)
- [Tokens Studio Documentation](https://docs.tokens.studio)
- [Tokens Studio Export to Figma](https://docs.tokens.studio/figma/export)

### Documentation
- [Storybook 8 Release](https://storybook.js.org/blog/storybook-8/)
- [Storybook Documentation](https://storybook.js.org/docs)
- [Chromatic for Storybook](https://www.chromatic.com/storybook)

### Naming Conventions
- [BEM Naming](https://getbem.com/naming/)
- [Design Tokens Naming Structure](https://medium.com/@brcsndr/you-dont-know-css-design-tokens-naming-structure-52add5d02682)

---

*Research completed: 2026-02-03*
*Ready for roadmap creation*
