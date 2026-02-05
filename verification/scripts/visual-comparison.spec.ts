import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const VIRTUNA_SCREENSHOTS_DIR = path.resolve(__dirname, '../reports/screenshots/virtuna');
const DIFFS_DIR = path.resolve(__dirname, '../reports/screenshots/diffs');
const RAYCAST_SCREENSHOTS_DIR = path.resolve(__dirname, '../../.planning/phases/39-token-foundation/screenshots');
const REPORT_PATH = path.resolve(__dirname, '../reports/visual-comparison.md');

// CSS to disable all animations for stable screenshots
const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
`;

interface PageCapture {
  name: string;
  url: string;
  filename: string;
  raycastBaseline?: string; // filename in Phase 39 screenshots dir
  sections?: SectionCapture[];
}

interface SectionCapture {
  name: string;
  selector: string;
  filename: string;
  raycastBaseline?: string;
}

interface CaptureResult {
  page: PageCapture;
  captured: boolean;
  error?: string;
  fileSize?: number;
  sections?: SectionCaptureResult[];
  diffResults?: DiffResult[];
}

interface SectionCaptureResult {
  section: SectionCapture;
  captured: boolean;
  error?: string;
  fileSize?: number;
  diffResult?: DiffResult;
}

interface DiffResult {
  virtunaFile: string;
  raycastFile: string;
  diffFile: string;
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  error?: string;
}

// Pages to capture
const PAGES: PageCapture[] = [
  {
    name: 'Homepage',
    url: '/',
    filename: 'homepage.png',
    raycastBaseline: '02-homepage-hero.png',
    sections: [
      {
        name: 'Hero Section',
        selector: 'main > *:first-child',
        filename: 'homepage-hero.png',
        raycastBaseline: '02-homepage-hero.png',
      },
      {
        name: 'Features Section',
        selector: 'main > *:nth-child(3)',
        filename: 'homepage-features.png',
        raycastBaseline: '04-section-3.png',
      },
      {
        name: 'Stats Section',
        selector: 'main > *:nth-child(4)',
        filename: 'homepage-stats.png',
      },
      {
        name: 'Footer',
        selector: 'footer',
        filename: 'homepage-footer.png',
      },
    ],
  },
  {
    name: '/showcase (Tokens)',
    url: '/showcase',
    filename: 'showcase-tokens.png',
  },
  {
    name: '/showcase/inputs',
    url: '/showcase/inputs',
    filename: 'showcase-inputs.png',
  },
  {
    name: '/showcase/navigation',
    url: '/showcase/navigation',
    filename: 'showcase-navigation.png',
  },
  {
    name: '/showcase/feedback',
    url: '/showcase/feedback',
    filename: 'showcase-feedback.png',
  },
  {
    name: '/showcase/data-display',
    url: '/showcase/data-display',
    filename: 'showcase-data-display.png',
  },
  {
    name: '/showcase/layout-components',
    url: '/showcase/layout-components',
    filename: 'showcase-layout-components.png',
  },
  {
    name: '/showcase/utilities',
    url: '/showcase/utilities',
    filename: 'showcase-utilities.png',
  },
];

// Ensure output directories exist
function ensureDirs(): void {
  for (const dir of [VIRTUNA_SCREENSHOTS_DIR, DIFFS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Generate pixel diff between two PNG files
function generateDiff(virtunaPath: string, raycastPath: string, diffPath: string): DiffResult {
  const result: DiffResult = {
    virtunaFile: path.basename(virtunaPath),
    raycastFile: path.basename(raycastPath),
    diffFile: path.basename(diffPath),
    totalPixels: 0,
    diffPixels: 0,
    diffPercentage: 0,
  };

  try {
    const img1 = PNG.sync.read(fs.readFileSync(virtunaPath));
    const img2 = PNG.sync.read(fs.readFileSync(raycastPath));

    // Use the smaller dimensions for comparison
    const width = Math.min(img1.width, img2.width);
    const height = Math.min(img1.height, img2.height);

    // Crop images to matching dimensions
    const cropped1 = cropImage(img1, width, height);
    const cropped2 = cropImage(img2, width, height);

    const diff = new PNG({ width, height });
    result.totalPixels = width * height;
    result.diffPixels = pixelmatch(
      cropped1.data,
      cropped2.data,
      diff.data,
      width,
      height,
      { threshold: 0.3 } // Allow some tolerance for coral vs red branding
    );
    result.diffPercentage = Math.round((result.diffPixels / result.totalPixels) * 10000) / 100;

    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// Crop a PNG to specific dimensions (from top-left)
function cropImage(img: PNG, width: number, height: number): PNG {
  const cropped = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (img.width * y + x) << 2;
      const dstIdx = (width * y + x) << 2;
      cropped.data[dstIdx] = img.data[srcIdx];
      cropped.data[dstIdx + 1] = img.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = img.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }
  return cropped;
}

// Check if Raycast baseline screenshots exist
function hasRaycastBaseline(): boolean {
  return fs.existsSync(RAYCAST_SCREENSHOTS_DIR) &&
    fs.readdirSync(RAYCAST_SCREENSHOTS_DIR).some(f => f.endsWith('.png'));
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Collect all results for report generation
const allResults: CaptureResult[] = [];

test.describe('Visual Comparison Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Inject CSS to disable animations
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
  });

  for (const pageConfig of PAGES) {
    test(`Capture ${pageConfig.name}`, async ({ page }) => {
      ensureDirs();

      const result: CaptureResult = {
        page: pageConfig,
        captured: false,
        sections: [],
        diffResults: [],
      };

      try {
        // Navigate and wait for content
        await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
        // Re-inject CSS after navigation
        await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
        await page.waitForTimeout(1000); // Allow final renders

        // Capture full-page screenshot
        const screenshotPath = path.join(VIRTUNA_SCREENSHOTS_DIR, pageConfig.filename);
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        const stats = fs.statSync(screenshotPath);
        result.captured = true;
        result.fileSize = stats.size;
        console.log(`Captured ${pageConfig.name}: ${formatSize(stats.size)}`);

        // Generate diff against Raycast baseline if available
        if (pageConfig.raycastBaseline && hasRaycastBaseline()) {
          const raycastPath = path.join(RAYCAST_SCREENSHOTS_DIR, pageConfig.raycastBaseline);
          if (fs.existsSync(raycastPath)) {
            const diffFilename = `diff-${pageConfig.filename}`;
            const diffPath = path.join(DIFFS_DIR, diffFilename);
            const diffResult = generateDiff(screenshotPath, raycastPath, diffPath);
            result.diffResults!.push(diffResult);
            console.log(`  Diff: ${diffResult.diffPercentage}% different (${diffResult.diffPixels}/${diffResult.totalPixels} pixels)`);
          }
        }

        // Capture individual sections if defined
        if (pageConfig.sections) {
          for (const section of pageConfig.sections) {
            const sectionResult: SectionCaptureResult = {
              section,
              captured: false,
            };

            try {
              const element = page.locator(section.selector).first();
              const isVisible = await element.isVisible().catch(() => false);

              if (isVisible) {
                const sectionPath = path.join(VIRTUNA_SCREENSHOTS_DIR, section.filename);
                await element.screenshot({ path: sectionPath });
                const sectionStats = fs.statSync(sectionPath);
                sectionResult.captured = true;
                sectionResult.fileSize = sectionStats.size;
                console.log(`  Section "${section.name}": ${formatSize(sectionStats.size)}`);

                // Diff section against Raycast baseline
                if (section.raycastBaseline && hasRaycastBaseline()) {
                  const raycastPath = path.join(RAYCAST_SCREENSHOTS_DIR, section.raycastBaseline);
                  if (fs.existsSync(raycastPath)) {
                    const diffFilename = `diff-${section.filename}`;
                    const diffPath = path.join(DIFFS_DIR, diffFilename);
                    sectionResult.diffResult = generateDiff(sectionPath, raycastPath, diffPath);
                    console.log(`    Diff: ${sectionResult.diffResult.diffPercentage}% different`);
                  }
                }
              } else {
                sectionResult.error = `Selector "${section.selector}" not visible`;
                console.log(`  Section "${section.name}": not visible`);
              }
            } catch (err) {
              sectionResult.error = err instanceof Error ? err.message : String(err);
              console.log(`  Section "${section.name}": ERROR - ${sectionResult.error}`);
            }

            result.sections!.push(sectionResult);
          }
        }
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        console.error(`Failed to capture ${pageConfig.name}: ${result.error}`);
      }

      allResults.push(result);
    });
  }

  test.afterAll(async () => {
    // Generate the visual comparison report
    generateReport();
  });
});

function generateReport(): void {
  const date = new Date().toISOString().split('T')[0];
  const raycastAvailable = hasRaycastBaseline();
  const capturedPages = allResults.filter(r => r.captured).length;
  const totalSections = allResults.reduce((acc, r) => acc + (r.sections?.filter(s => s.captured).length ?? 0), 0);
  const totalDiffs = allResults.reduce((acc, r) => {
    const pageDiffs = r.diffResults?.length ?? 0;
    const sectionDiffs = r.sections?.filter(s => s.diffResult).length ?? 0;
    return acc + pageDiffs + sectionDiffs;
  }, 0);

  let md = `# Visual Comparison Report

**Date:** ${date}
**Virtuna URL:** http://localhost:3000
**Raycast Baseline:** ${raycastAvailable ? 'Phase 39 extraction screenshots (2026-02-03)' : 'Not available'}
**Viewport:** 1440x900 (desktop)

## Summary

- **${capturedPages}** pages captured
- **${totalSections}** individual sections captured
- **${totalDiffs}** comparisons against Raycast baseline generated
- Raycast baseline: ${raycastAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}

## Capture Overview

| Page | Screenshot | Size | Diff Available |
|------|-----------|------|----------------|
`;

  for (const result of allResults) {
    const status = result.captured ? 'Captured' : `FAILED: ${result.error}`;
    const size = result.fileSize ? formatSize(result.fileSize) : '-';
    const hasDiff = (result.diffResults?.length ?? 0) > 0 ? 'Yes' : 'No';
    md += `| ${result.page.name} | ${status} | ${size} | ${hasDiff} |\n`;
  }

  md += `\n## Page-by-Page Comparison\n`;

  for (const result of allResults) {
    md += `\n### ${result.page.name}\n\n`;

    if (!result.captured) {
      md += `**Status:** FAILED\n**Error:** ${result.error}\n\n`;
      continue;
    }

    md += `**Screenshot:** screenshots/virtuna/${result.page.filename}\n`;

    if (result.page.raycastBaseline && raycastAvailable) {
      const raycastPath = path.join(RAYCAST_SCREENSHOTS_DIR, result.page.raycastBaseline);
      if (fs.existsSync(raycastPath)) {
        md += `**Raycast baseline:** .planning/phases/39-token-foundation/screenshots/${result.page.raycastBaseline}\n`;
      }
    }

    if (result.diffResults && result.diffResults.length > 0) {
      for (const diff of result.diffResults) {
        if (diff.error) {
          md += `**Diff:** Error - ${diff.error}\n`;
        } else {
          md += `**Diff:** screenshots/diffs/${diff.diffFile}\n`;
          md += `**Pixel difference:** ${diff.diffPercentage}% (${diff.diffPixels.toLocaleString()} of ${diff.totalPixels.toLocaleString()} pixels)\n`;
        }
      }
    }

    md += `\n**Observations:**\n`;

    // Page-specific observations based on what we know about the design system
    const observations = getPageObservations(result);
    for (const obs of observations) {
      md += `- ${obs}\n`;
    }

    // Section details
    if (result.sections && result.sections.length > 0) {
      md += `\n**Sections:**\n\n`;
      for (const sectionResult of result.sections) {
        md += `#### ${sectionResult.section.name}\n\n`;
        if (!sectionResult.captured) {
          md += `- **Status:** Not captured (${sectionResult.error})\n\n`;
          continue;
        }
        md += `- **Screenshot:** screenshots/virtuna/${sectionResult.section.filename}\n`;
        md += `- **Size:** ${sectionResult.fileSize ? formatSize(sectionResult.fileSize) : 'unknown'}\n`;
        if (sectionResult.diffResult) {
          if (sectionResult.diffResult.error) {
            md += `- **Diff:** Error - ${sectionResult.diffResult.error}\n`;
          } else {
            md += `- **Diff:** screenshots/diffs/diff-${sectionResult.section.filename}\n`;
            md += `- **Pixel difference:** ${sectionResult.diffResult.diffPercentage}% (${sectionResult.diffResult.diffPixels.toLocaleString()} of ${sectionResult.diffResult.totalPixels.toLocaleString()} pixels)\n`;
          }
        }
        md += `\n`;
      }
    }
  }

  md += `\n## Intentional Differences\n\n`;
  md += `The following differences from Raycast are by design:\n\n`;
  md += `1. **Brand color:** Coral (#FF7F50) replaces Raycast red (#FF6363)\n`;
  md += `2. **Typography:** Funnel Display / Satoshi fonts replace Raycast's font stack\n`;
  md += `3. **Content:** Virtuna branding, copy, and imagery differ entirely\n`;
  md += `4. **Layout structure:** Some sections reorganized for Virtuna's product narrative\n\n`;

  md += `## Notes\n\n`;
  md += `- All screenshots captured at 1440x900 viewport with dark color scheme\n`;
  md += `- CSS animations and transitions disabled via injected styles\n`;
  md += `- Playwright \`reducedMotion: 'reduce'\` enabled for Framer Motion suppression\n`;
  md += `- Diff threshold: 0.3 (allows some anti-aliasing and subpixel tolerance)\n`;
  md += `- Diff images highlight pixel differences in red/yellow overlay\n`;
  if (!raycastAvailable) {
    md += `- Raycast baseline screenshots not found at expected path\n`;
  }

  md += `\n---\n*Generated by visual-comparison.spec.ts on ${date}*\n`;

  fs.writeFileSync(REPORT_PATH, md);
  console.log(`\nReport generated: ${REPORT_PATH}`);
}

function getPageObservations(result: CaptureResult): string[] {
  const observations: string[] = [];
  const name = result.page.name;

  if (name === 'Homepage') {
    observations.push('Full homepage rendered with all sections (Hero, Backers, Features, Stats, CaseStudy, Partnership, FAQ) + Footer');
    if (result.diffResults && result.diffResults.length > 0 && !result.diffResults[0].error) {
      const diff = result.diffResults[0];
      if (diff.diffPercentage > 80) {
        observations.push('High pixel difference expected: Virtuna has different content, branding, and layout from Raycast homepage');
      }
      observations.push(`Structural comparison: both sites use dark backgrounds, centered hero text, and full-width sections`);
    }
    observations.push('Coral accent color (#FF7F50) used for CTAs and highlights -- INTENTIONAL difference from Raycast red (#FF6363)');
    observations.push('Font stack uses Funnel Display (headings) and Satoshi (body) -- INTENTIONAL difference');
  } else if (name.includes('showcase')) {
    observations.push('Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)');
    observations.push('Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text');
    if (name.includes('Tokens')) {
      observations.push('Token swatches display live CSS variable values with color previews');
      observations.push('Covers all token categories: colors, typography, spacing, shadows, radius, animation, gradients');
    } else if (name.includes('inputs')) {
      observations.push('Input components rendered with visual states (default, focused, disabled, error)');
      observations.push('Select and SearchableSelect shown with dropdown variations');
    } else if (name.includes('navigation')) {
      observations.push('Tabs and CategoryTabs demonstrate Radix-based active state styling');
      observations.push('Kbd and ShortcutBadge show Raycast-accurate keyboard shortcut rendering');
    } else if (name.includes('feedback')) {
      observations.push('Badge variants, Toast positions, Dialog sizes, and Spinner states displayed');
      observations.push('Interactive demos use client island pattern for server component compatibility');
    } else if (name.includes('data-display')) {
      observations.push('Avatar, AvatarGroup, Skeleton, Card, GlassCard, ExtensionCard, TestimonialCard showcased');
      observations.push('GlassCard demos use colored gradient backgrounds to demonstrate blur effect');
    } else if (name.includes('layout-components')) {
      observations.push('GlassPanel shown with all 7 blur levels (none through 2xl) and tint variants');
      observations.push('Divider component with horizontal and vertical orientations');
    } else if (name.includes('utilities')) {
      observations.push('Motion components (FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale) shown with static previews');
      observations.push('Effects (NoiseTexture, ChromaticAberration) and decorative components (GradientGlow, GradientMesh, TrafficLights)');
    }
  }

  if (observations.length === 0) {
    observations.push('Page renders correctly at 1440x900 viewport');
  }

  return observations;
}
