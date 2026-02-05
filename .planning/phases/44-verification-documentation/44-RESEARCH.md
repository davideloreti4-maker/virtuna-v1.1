# Phase 44: Verification & Documentation - Research

**Researched:** 2026-02-05
**Domain:** Design system verification (visual comparison, accessibility auditing) + documentation generation
**Confidence:** HIGH

## Summary

Phase 44 is a documentation-and-audit phase -- it produces reports, markdown docs, and verification artifacts but does NOT modify component code. The primary technical domains are: (1) Playwright-based visual screenshot comparison between Virtuna pages and Raycast reference, (2) programmatic WCAG AA color contrast auditing of the token system, (3) static analysis to detect hardcoded values in component code, and (4) structured design system documentation in markdown + enhanced showcase pages.

The codebase already has Playwright installed (`@playwright/test ^1.58.0`), an existing extraction Playwright config (extraction/playwright.config.ts), and rich extraction data from Phase 39 (39-EXTRACTION-DATA.md with exact Raycast values + screenshots). The token system is mature: 226 lines in globals.css with two-tier architecture (primitive + semantic), 21 UI components with typed props via CVA/TypeScript, 7 motion components, 2 effects, and 29 primitives.

**Primary recommendation:** Use Playwright's built-in `toHaveScreenshot()` + custom pixelmatch scripts for visual comparison, `wcag-contrast` npm package for programmatic color auditing, grep/AST-based scanning for hardcoded values, and structured markdown in a `docs/` directory alongside an updated BRAND-BIBLE.md for documentation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.58.0 | Visual screenshot capture & comparison | Already installed; built-in `toHaveScreenshot()` uses pixelmatch internally |
| `wcag-contrast` | 3.0.0 | WCAG contrast ratio calculation | 59K weekly downloads; provides `hex()`, `rgb()`, `score()` functions; has `@types/wcag-contrast` |
| `pixelmatch` | 6.x | Pixel-level image diffing (already bundled with Playwright) | Playwright uses it internally; can also use standalone for custom diff generation |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pngjs` | latest | PNG read/write for custom diff image generation | Only if generating standalone diff images outside Playwright assertions |
| `color.js` or `chroma.js` | latest | oklch/hex/rgb color space conversion | For converting oklch tokens to hex/rgb before feeding to wcag-contrast |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wcag-contrast | color-contrast-checker (BBC) | BBC's is more full-featured but heavier; wcag-contrast is simpler and sufficient for ratio + score |
| wcag-contrast | get-contrast | Handles more color formats natively but less maintained |
| Custom color conversion | @texel/color | Tiny (3.5kb) oklch-to-srgb but less ecosystem adoption |
| Standalone pixelmatch | Playwright toHaveScreenshot | Use toHaveScreenshot for same-site regression; standalone pixelmatch for cross-site comparison (Virtuna vs Raycast) |

**Installation:**
```bash
pnpm add -D wcag-contrast @types/wcag-contrast pngjs
```

Note: `@playwright/test` and `pixelmatch` are already available (Playwright bundles pixelmatch). `chroma.js` or a manual oklch-to-rgb converter may be needed for oklch token values.

## Architecture Patterns

### Recommended Project Structure

```
virtuna-v1.1/
├── docs/                              # NEW - documentation root
│   ├── tokens.md                      # Token reference (all values + usage)
│   ├── components.md                  # Component API docs (props, variants, examples)
│   ├── usage-guidelines.md            # When to use/not use each component
│   ├── accessibility.md               # Accessibility requirements per component
│   ├── motion-guidelines.md           # Motion/animation guidelines
│   ├── contributing.md                # Contribution guide (naming, patterns, extending)
│   └── component-index.md            # Component index with links to source + showcase
├── BRAND-BIBLE.md                     # Top-level brand guide (updated)
├── verification/                      # NEW - verification scripts + reports
│   ├── playwright.config.ts           # Verification-specific Playwright config
│   ├── scripts/
│   │   ├── visual-comparison.spec.ts  # Playwright screenshot capture + comparison
│   │   ├── contrast-audit.ts          # WCAG contrast ratio audit script
│   │   └── hardcoded-values-scan.ts   # Grep/scan for hardcoded color/spacing values
│   └── reports/
│       ├── visual-comparison.md       # Discrepancy report with screenshots
│       ├── contrast-audit.md          # WCAG AA compliance report
│       └── hardcoded-values.md        # Hardcoded values report
```

### Pattern 1: Cross-Site Visual Comparison with Playwright

**What:** Capture screenshots of both Virtuna (localhost) and Raycast (raycast.com), then compare using pixelmatch to generate diff images and a discrepancy report.

**When to use:** For VER-01 (visual comparison between /showcase and Raycast reference) and the full-site marketing page comparison.

**Key insight:** Playwright's `toHaveScreenshot()` is designed for same-site regression (comparing a page to its own baseline). For cross-site comparison (Virtuna vs Raycast), use `page.screenshot()` to capture both sites, then use pixelmatch directly to generate diff images.

**Example:**
```typescript
// Source: Playwright docs (https://playwright.dev/docs/test-snapshots)
// + pixelmatch (https://github.com/mapbox/pixelmatch)

import { test } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';

test('compare hero section', async ({ browser }) => {
  // Capture Virtuna
  const virtunaPage = await browser.newPage();
  await virtunaPage.goto('http://localhost:3000');
  await virtunaPage.waitForLoadState('networkidle');
  const virtunaShot = await virtunaPage.screenshot({
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });

  // Capture Raycast
  const raycastPage = await browser.newPage();
  await raycastPage.goto('https://raycast.com');
  await raycastPage.waitForLoadState('networkidle');
  const raycastShot = await raycastPage.screenshot({
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });

  // Compare with pixelmatch
  const img1 = PNG.sync.read(virtunaShot);
  const img2 = PNG.sync.read(raycastShot);
  const diff = new PNG({ width: img1.width, height: img1.height });
  const numDiffPixels = pixelmatch(
    img1.data, img2.data, diff.data,
    img1.width, img1.height,
    { threshold: 0.3 } // Allow some color tolerance for coral vs red
  );

  // Save diff image
  fs.writeFileSync('reports/hero-diff.png', PNG.sync.write(diff));

  // Log results (don't assert -- this is documentation, not a pass/fail test)
  console.log(`Hero section: ${numDiffPixels} different pixels`);
});
```

### Pattern 2: Programmatic WCAG Contrast Audit

**What:** Extract all foreground/background color combinations from the token system and compute WCAG contrast ratios programmatically.

**When to use:** For VER-03 (all color combinations verified for WCAG AA compliance).

**Key challenge:** Many tokens use oklch format. The `wcag-contrast` package requires hex or RGB input. Need a conversion step.

**Example:**
```typescript
// Source: wcag-contrast npm (https://www.npmjs.com/package/wcag-contrast)
import { hex, score } from 'wcag-contrast';

// Token pairs to check (foreground on background)
const pairs = [
  { fg: '#f5f5f5', bg: '#07080a', label: 'foreground on background' },
  { fg: '#9c9c9d', bg: '#07080a', label: 'foreground-secondary on background' },
  { fg: '#6a6b6c', bg: '#07080a', label: 'foreground-muted on background' },
  // ... all semantic foreground/background combinations
];

for (const pair of pairs) {
  const ratio = hex(pair.fg, pair.bg);
  const wcagScore = score(ratio);
  const passesAA = ratio >= 4.5;
  console.log(`${pair.label}: ${ratio.toFixed(2)}:1 (${wcagScore}) ${passesAA ? 'PASS' : 'FAIL'}`);
}
```

### Pattern 3: Hardcoded Values Detection

**What:** Scan component source files for hex colors, rgb/rgba values, and pixel values that should be using tokens instead.

**When to use:** For VER-06 (no hardcoded values in component code).

**Key insight from codebase analysis:** The grep search already reveals hardcoded values in the codebase:
- `src/components/ui/skeleton.tsx`: `rgba(255, 255, 255, 0.05)` and `rgba(255, 255, 255, 0.08)`
- `src/components/ui/kbd.tsx`: Multiple `rgba()` and `rgb()` values for Raycast-style keyboard shadows
- `src/components/ui/card.tsx`: `rgba(255, 255, 255, 0.06)` box-shadow, `rgba(255, 255, 255, 0.05)` glass background
- `src/components/app/auth-guard.tsx`: `bg-[#0A0A0A]` (arbitrary value)
- `src/components/app/survey-form.tsx`: `bg-[#18181B]` (arbitrary value)
- `src/components/primitives/TrafficLights.tsx`: Hardcoded macOS traffic light colors (intentional)
- Various `src/components/app/` files: zinc-800, `#18181B`, etc.

**Approach:** Use grep-based scanning with allowlists. Some hardcoded values are intentional (e.g., TrafficLights macOS colors, Raycast-extracted shadows that have no token equivalent). The scan should:
1. Find all hex, rgb, rgba patterns in component code
2. Cross-reference against globals.css token values
3. Flag values that HAVE a token equivalent but aren't using it
4. Allow-list intentional hardcoded values (with justification)

### Pattern 4: Documentation as Markdown + Living Docs

**What:** Dual documentation: static markdown in `docs/` for developer reference, enhanced `/showcase` pages as living interactive docs.

**When to use:** For DOC-01 through DOC-08.

**Structure per component doc:**
```markdown
## Button

### Description
[What it does, when to use]

### Import
\`\`\`tsx
import { Button } from '@/components/ui';
\`\`\`

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'primary' \| 'secondary' \| 'ghost' \| 'destructive' | 'secondary' | Visual style |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Size variant |
| asChild | boolean | false | Render as Radix Slot |
| loading | boolean | false | Show loading spinner |

### Variants
[Visual examples or reference to /showcase]

### Accessibility
- Focus ring: 2px accent with background offset
- aria-busy when loading
- aria-disabled when disabled

### Do's and Don'ts
- DO: Use secondary as default, primary for main CTA only
- DON'T: Use more than one primary button per section
```

### Anti-Patterns to Avoid

- **Running assertions that FAIL the verification tests:** This phase documents discrepancies; it does NOT fix them. Never use `expect().toBe()` assertions that would fail -- use logging and report generation instead.
- **Modifying component code during documentation:** Phase 44 is read-only for component code. All fixes go to a future phase/backlog.
- **Including Raycast relationship in user-facing content:** CONTEXT.md specifies Raycast inspiration is acknowledged in internal repo docs only, not public-facing.
- **Checking keyboard/focus/screen-reader accessibility:** CONTEXT.md limits accessibility scope to color contrast only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast ratio math | Custom luminance/ratio calculator | `wcag-contrast` npm package | The WCAG relative luminance formula has edge cases; established libraries handle these correctly |
| Pixel-level image comparison | Custom pixel diff | `pixelmatch` (via Playwright or standalone) | Anti-aliasing detection, perceptual color diff, proven at scale |
| oklch to hex conversion | Manual math | `chroma.js` or computed style extraction via Playwright | oklch-to-sRGB gamut mapping is complex; use established libraries |
| Screenshot stabilization | Custom wait/retry logic | Playwright's `toHaveScreenshot()` auto-wait | Playwright waits for two consecutive identical screenshots automatically |
| Color format parsing | Regex-based color parsing | Existing color libraries | CSS color formats are surprisingly complex (named colors, currentColor, etc.) |

**Key insight:** The contrast audit needs a color conversion step because globals.css uses oklch for many tokens. The most reliable approach is to use Playwright's `browser_evaluate` to read `getComputedStyle()` from a running page, which returns rgb() values (browser does the oklch conversion). This avoids needing a separate oklch library entirely.

## Common Pitfalls

### Pitfall 1: Screenshot Instability from Animations and Dynamic Content

**What goes wrong:** Screenshots capture mid-animation states, causing false diffs between runs.
**Why it happens:** Framer Motion animations, shimmer effects, gradient animations, and glow-breathe/glow-float/glow-drift keyframes run continuously on Virtuna pages.
**How to avoid:**
- Use `prefers-reduced-motion: reduce` in Playwright viewport settings
- Wait for `networkidle` before capturing
- Add explicit `waitForTimeout` for any remaining JS animations
- Disable CSS animations via injected styles: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`
**Warning signs:** Flaky diff pixel counts that change between runs.

### Pitfall 2: oklch-to-Hex Mismatch in Contrast Calculations

**What goes wrong:** Manually converting oklch tokens to hex for contrast checking produces slightly different values than what the browser renders.
**Why it happens:** oklch-to-sRGB conversion involves gamut mapping. Tailwind v4's @theme compilation is known to be inaccurate for low-lightness colors (documented in Phase 42 memory).
**How to avoid:** Extract computed RGB values from a running browser using `getComputedStyle()` via Playwright, rather than converting oklch values manually. The browser is the source of truth for what users actually see.
**Warning signs:** Contrast ratios that are borderline pass/fail (4.3-4.7:1 range).

### Pitfall 3: Raycast Site Changes Breaking Comparison

**What goes wrong:** Raycast.com may have changed layout/design between when tokens were extracted (Phase 39, 2026-02-03) and when comparison runs.
**Why it happens:** Raycast is a live product that updates regularly.
**How to avoid:**
- Use Phase 39 extraction screenshots as the "Raycast reference" baseline rather than live-capturing from raycast.com every time
- If live comparison is needed, capture Raycast screenshots once and store them as fixtures
- Document the Raycast capture date in the comparison report
**Warning signs:** Large layout-level diffs that are clearly from Raycast updates, not Virtuna issues.

### Pitfall 4: Scope Creep from "Document-Only" Mandate

**What goes wrong:** Finding issues during verification and fixing them instead of documenting.
**Why it happens:** Natural developer instinct to fix problems when found.
**How to avoid:** CONTEXT.md is explicit: "Discrepancies are documented only, not fixed in this phase." Create a structured report format with severity levels, and a separate backlog file for fixes.
**Warning signs:** PRs that modify component CSS/TSX alongside documentation files.

### Pitfall 5: Inconsistent Responsive Comparison Viewports

**What goes wrong:** Comparing Virtuna at 375px against Raycast at 375px when both sites have different responsive breakpoints.
**Why it happens:** Raycast's mobile breakpoints may not match Tailwind defaults used in Virtuna.
**How to avoid:** Test at exact breakpoints defined in globals.css: sm(640), md(768), lg(1024), xl(1280), 2xl(1536). Document which breakpoints Raycast uses and note any differences.
**Warning signs:** Responsive diffs that are really breakpoint threshold differences.

## Code Examples

### Example 1: Extract Computed Colors from Running Browser

```typescript
// Source: Playwright docs + codebase pattern from extraction tests
// Use this instead of manual oklch-to-hex conversion

import { chromium } from 'playwright';

async function extractComputedColors() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  // Extract all CSS custom property values as computed RGB
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const props = [
      'color-background', 'color-foreground', 'color-foreground-secondary',
      'color-foreground-muted', 'color-accent', 'color-accent-hover',
      'color-surface', 'color-surface-elevated', 'color-border',
      'color-success', 'color-warning', 'color-error', 'color-info',
      // ... all semantic tokens
    ];
    return props.map(p => ({
      name: p,
      value: style.getPropertyValue(`--${p}`).trim()
    }));
  });

  await browser.close();
  return tokens; // Returns RGB values as browser computes them
}
```

### Example 2: WCAG Contrast Audit Report Generator

```typescript
import { hex, score } from 'wcag-contrast';

interface ContrastResult {
  foreground: string;
  background: string;
  label: string;
  ratio: number;
  score: string;
  passesAA: boolean;
  passesAALarge: boolean;
}

function auditContrast(
  fgHex: string, bgHex: string, label: string
): ContrastResult {
  const ratio = hex(fgHex, bgHex);
  return {
    foreground: fgHex,
    background: bgHex,
    label,
    ratio: Math.round(ratio * 100) / 100,
    score: score(ratio),
    passesAA: ratio >= 4.5,
    passesAALarge: ratio >= 3.0,
  };
}

function generateReport(results: ContrastResult[]): string {
  const failures = results.filter(r => !r.passesAA);
  const passes = results.filter(r => r.passesAA);

  let md = `# WCAG AA Color Contrast Audit\n\n`;
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Standard:** WCAG 2.1 Level AA\n`;
  md += `**Results:** ${passes.length} pass, ${failures.length} fail\n\n`;

  if (failures.length > 0) {
    md += `## Failures\n\n`;
    md += `| Combination | Ratio | Score | Required |\n`;
    md += `|-------------|-------|-------|----------|\n`;
    for (const f of failures) {
      md += `| ${f.label} | ${f.ratio}:1 | ${f.score} | 4.5:1 (AA) |\n`;
    }
  }

  md += `\n## Passes\n\n`;
  md += `| Combination | Ratio | Score |\n`;
  md += `|-------------|-------|-------|\n`;
  for (const p of passes) {
    md += `| ${p.label} | ${p.ratio}:1 | ${p.score} |\n`;
  }

  return md;
}
```

### Example 3: Hardcoded Value Scanner

```typescript
// Scan component files for hardcoded color/spacing values
import fs from 'fs';
import path from 'path';

const PATTERNS = {
  hexColor: /#[0-9a-fA-F]{3,8}/g,
  rgbColor: /rgba?\(\s*\d+/g,
  arbitraryTailwind: /\b(bg|text|border|shadow)-\[#[0-9a-fA-F]+\]/g,
};

// Allow-list: intentional hardcoded values
const ALLOWLIST = [
  'TrafficLights.tsx',           // macOS traffic light colors
  'GlassOrb.tsx',                // Three.js shader colors
  'network-visualization.tsx',   // Data visualization colors
];

function scanFile(filePath: string): Array<{
  file: string; line: number; match: string; pattern: string
}> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings: Array<{ file: string; line: number; match: string; pattern: string }> = [];

  const fileName = path.basename(filePath);
  if (ALLOWLIST.includes(fileName)) return findings;

  lines.forEach((line, idx) => {
    for (const [name, pattern] of Object.entries(PATTERNS)) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        findings.push({
          file: filePath,
          line: idx + 1,
          match: match[0],
          pattern: name,
        });
      }
    }
  });

  return findings;
}
```

### Example 4: Playwright Visual Comparison Config

```typescript
// verification/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { outputFolder: 'reports/html' }], ['list']],
  outputDir: 'reports/test-results',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    // Disable animations for stable screenshots
    reducedMotion: 'reduce',
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
  ],
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual side-by-side comparison | Playwright `toHaveScreenshot()` + pixelmatch | Playwright 1.22+ | Automated, CI-integrated visual regression |
| WCAG 2.0 contrast only | WCAG 2.1 + APCA emerging | 2023-2025 | APCA (Advanced Perceptual Contrast Algorithm) is in WCAG 3.0 draft; stick with WCAG 2.1 AA for now |
| Storybook-only docs | Markdown + living showcase pages | 2024-2026 | Multi-format docs (markdown for devs, web for designers) |
| Manual token auditing | Automated CSS custom property extraction | 2025-2026 | getComputedStyle() gives browser-accurate values |
| oklch manual conversion | Browser-computed values via getComputedStyle | Tailwind v4 (2024-2025) | Avoids oklch compilation inaccuracies documented in Phase 42 |

**Deprecated/outdated:**
- Storybook-only documentation: Modern design systems use both static docs and interactive showcases
- Manual contrast checking with WebAIM calculator: Use programmatic tools for full-system audits
- CSS-level linting (Stylelint) for token enforcement: Use grep/AST scanning targeting component code directly

## Codebase-Specific Findings

### Token Inventory (from globals.css)

The token system is comprehensive:
- **Coral scale:** 9 steps (100-900), oklch format
- **Gray scale:** 11 steps (50-950), mix of oklch and hex (dark grays use hex per Phase 42 decision)
- **Semantic colors:** 23 tokens (backgrounds, text, accent, status, borders, states)
- **Typography:** 3 font families, 11 font sizes, 4 weights, 5 line heights, 3 letter spacings
- **Spacing:** 13 steps (0-96px)
- **Shadows:** 7 variants including Raycast button shadow
- **Radii:** 9 steps
- **Durations:** 3 (fast/normal/slow)
- **Easings:** 4 curves
- **Z-index:** 7 layers
- **Gradients:** 6 presets

### Component Inventory (from src/components/ui/index.ts)

21 UI components with TypeScript exports:
- **Interactive:** Button, Input, InputField, Select, SearchableSelect, Toggle, Dialog, Tabs, CategoryTabs
- **Display:** Badge, Card, GlassCard, Avatar, AvatarGroup, Skeleton, ExtensionCard, TestimonialCard
- **Typography:** Heading, Text, Caption, Code
- **Utility:** Spinner, Icon, Divider, Kbd, ShortcutBadge, ToastProvider/useToast
- **Accordion:** AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent

### Existing Hardcoded Values Found

**In UI components (src/components/ui/):**
- `skeleton.tsx`: rgba values for shimmer effect
- `kbd.tsx`: Multiple rgba/rgb for Raycast keyboard shadows
- `card.tsx`: rgba for glass background and box-shadow
- `dialog.tsx`: Inline styles
- `extension-card.tsx`: Gradient themes via inline style
- `select.tsx`: Inline styles
- `spinner.tsx`: Inline styles

**In app components (src/components/app/):**
- `auth-guard.tsx`: `bg-[#0A0A0A]`
- `survey-form.tsx`: `bg-[#18181B]`, zinc-800
- `app-shell.tsx`: `bg-[#0A0A0A]`
- `filter-pills.tsx`: Hardcoded country colors
- `create-society-modal.tsx`: `#18181B`, zinc-800
- `leave-feedback-modal.tsx`: `#18181B`, zinc-800

**In other components:**
- `primitives/TrafficLights.tsx`: macOS traffic light colors (intentional)
- `visualization/GlassOrb.tsx`: THREE.Color values (intentional -- shader colors)
- `landing/persona-card.tsx`: `bg-[#1a1a1a]`

### Showcase Page Coverage

The existing showcase covers all major component categories:
- `/showcase` -- Tokens (colors, typography, spacing, shadows, radius, animation, gradients)
- `/showcase/inputs` -- Input, InputField, Select, SearchableSelect, Toggle
- `/showcase/navigation` -- Tabs, CategoryTabs, Kbd, ShortcutBadge
- `/showcase/feedback` -- Badge, Toast, Dialog, Spinner
- `/showcase/data-display` -- Avatar, AvatarGroup, Skeleton, Card, GlassCard, ExtensionCard, TestimonialCard
- `/showcase/layout-components` -- GlassPanel, Divider
- `/showcase/utilities` -- FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, NoiseTexture, ChromaticAberration, GradientGlow, GradientMesh, TrafficLights

### Marketing Pages for Full-Site Comparison

Homepage sections: HeroSection, BackersSection, FeaturesSection, StatsSection, CaseStudySection, PartnershipSection, FAQSection + Footer.

Corresponding Raycast pages extracted in Phase 39:
- Homepage (raycast.com)
- Store, Pro, AI, Pricing, Teams, iOS, Windows pages

### Extraction Reference Data

Phase 39 provides exact Raycast values in `39-EXTRACTION-DATA.md`:
- Global navbar (glass effect, link colors, button shadows)
- Homepage section-by-section (hero, features, stats, etc.)
- Screenshots in `.planning/phases/39-token-foundation/screenshots/`

This data is the "source of truth" for token verification (VER-02).

## Recommendations for Claude's Discretion Areas

### Component API Documentation Depth

**Recommendation:** Three tiers based on complexity:
1. **Full docs** (props table, all variants, examples, accessibility, do's/don'ts): Button, Input, InputField, Select, SearchableSelect, Dialog, Toast, Card, GlassCard
2. **Standard docs** (props table, key variants, one example): Badge, Toggle, Tabs, CategoryTabs, Avatar, AvatarGroup, Kbd, ShortcutBadge, ExtensionCard, TestimonialCard
3. **Brief docs** (description, import, key props): Spinner, Icon, Skeleton, Divider, Heading, Text, Caption, Code

### Token Reference Color Scope

**Recommendation:** Audit ALL semantic foreground/background combinations (not just coral). Rationale:
- The gray scale (gray-400, gray-500, gray-600 on gray-950) are the most likely contrast failures
- Status colors (success, warning, error, info) on dark backgrounds need checking
- Coral-on-dark is likely fine (coral-500 oklch L=0.72 is fairly bright)
- Border colors don't need contrast checking (decorative, not informational)

Estimated combinations: ~30-40 meaningful pairs (3 text colors x 4 backgrounds x relevant status/accent variations).

### Brand Bible File Structure

**Recommendation:** Single BRAND-BIBLE.md at repo root with internal sections. Rationale:
- The success criteria specifically reference "BRAND-BIBLE.md updated" (singular file)
- A single file is easier to find and reference
- Internal sections can link to detailed docs in `docs/` for deep dives
- Keep it under 500 lines by linking to docs/ subdocs for details

### Color Usage Guidance Format

**Recommendation:** Rules-based with examples. Structure:
1. **Rules** (when to use coral, when to use neutral)
2. **Examples** (show correct and incorrect usage)
3. **Reference table** (quick-look token-to-use-case mapping)

## Open Questions

1. **Figma-ready design specs (DOC-07)**
   - What we know: Requirement asks for "Figma-ready design specs exported"
   - What's unclear: No Figma integration exists in the project. This likely means structured JSON/markdown that a designer could translate to Figma
   - Recommendation: Generate a structured token export (JSON format matching W3C Design Tokens spec) + annotated screenshot reference images. Flag this as "Figma translation needed" rather than actual Figma file generation

2. **Component composition testing (VER-05)**
   - What we know: "All components tested in composition (real page contexts)" -- the marketing pages use these components
   - What's unclear: Whether to screenshot every marketing page section or just verify components render in context
   - Recommendation: Capture full-page screenshots of homepage + each showcase page. Composition verification is visual confirmation, not unit testing

3. **Responsive verification scope (VER-07)**
   - What we know: Need to verify mobile, tablet, desktop
   - What's unclear: Virtuna's sidebar is hidden on mobile (Phase 43 decision: `md:block`), and the extraction showed "expand window" message on mobile for the app -- so responsive scope is marketing pages + showcase only
   - Recommendation: Test at 375px (mobile), 768px (tablet), 1440px (desktop) for marketing and showcase pages. App pages are desktop-only by design

## Sources

### Primary (HIGH confidence)
- Context7: `/microsoft/playwright.dev` -- visual comparison docs, toHaveScreenshot API, pixelmatch integration
- Codebase analysis: globals.css (226 lines, full token inventory), components/ui/index.ts (21 components), package.json (Playwright ^1.58.0)
- Phase 39 extraction data: `39-EXTRACTION-DATA.md` with exact Raycast values
- Phase 42 memory: oklch-to-hex compilation inaccuracy for dark colors in Tailwind v4 @theme

### Secondary (MEDIUM confidence)
- WebSearch: wcag-contrast npm package (v3.0.0, 59K weekly downloads, provides hex(), rgb(), score())
- WebSearch: pixelmatch (150 LOC, zero deps, perceptual color diff with anti-aliasing detection)
- WebSearch: chroma.js / Color.js for oklch conversion
- WebSearch: eslint-plugin-tailwindcss `no-arbitrary-value` rule for detecting hardcoded Tailwind values

### Tertiary (LOW confidence)
- WebSearch: Design system documentation best practices -- general patterns, not project-specific
- WebSearch: APCA (Advanced Perceptual Contrast Algorithm) in WCAG 3.0 draft -- emerging standard, not needed for this phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright already installed, wcag-contrast is well-established, patterns verified against Context7 docs
- Architecture: HIGH - Based on codebase analysis of existing structure, CONTEXT.md decisions, and proven documentation patterns
- Pitfalls: HIGH - oklch issue documented in project memory (Phase 42), animation instability is well-known Playwright challenge, Raycast site changes are inherent risk
- Code examples: MEDIUM - Patterns from official Playwright docs + npm package docs, adapted for project-specific needs

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- stable domain, no fast-moving dependencies)
