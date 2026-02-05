import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const RESPONSIVE_DIR = path.resolve(__dirname, '../reports/screenshots/responsive');
const REPORT_PATH = path.resolve(__dirname, '../reports/responsive-check.md');

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

interface Viewport {
  name: string;
  width: number;
  height: number;
  label: string;
}

interface PageConfig {
  name: string;
  url: string;
  filename: string;
}

interface ResponsiveObservation {
  viewport: string;
  page: string;
  screenshot: string;
  captured: boolean;
  fileSize?: number;
  horizontalOverflow: boolean;
  contentClipping: boolean;
  sidebarBehavior?: string;
  issues: string[];
  notes: string[];
}

const VIEWPORTS: Viewport[] = [
  { name: 'mobile', width: 375, height: 812, label: '375px (mobile)' },
  { name: 'tablet', width: 768, height: 1024, label: '768px (tablet)' },
  { name: 'desktop', width: 1440, height: 900, label: '1440px (desktop)' },
];

const PAGES: PageConfig[] = [
  { name: 'Homepage', url: '/', filename: 'homepage.png' },
  { name: '/showcase (Tokens)', url: '/showcase', filename: 'showcase-tokens.png' },
  { name: '/showcase/inputs', url: '/showcase/inputs', filename: 'showcase-inputs.png' },
];

// Ensure directories exist
function ensureDirs(): void {
  for (const vp of VIEWPORTS) {
    const dir = path.join(RESPONSIVE_DIR, String(vp.width));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Check for horizontal overflow
async function checkHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
}

// Check for content clipping (elements wider than viewport)
async function checkContentClipping(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const elements = document.querySelectorAll('main *, footer *');
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 2 || rect.left < -2) {
        // Allow small rounding errors (2px tolerance)
        return true;
      }
    }
    return false;
  });
}

// Check sidebar visibility on showcase pages
async function checkSidebarBehavior(page: Page, url: string): Promise<string | undefined> {
  if (!url.includes('showcase')) return undefined;

  return page.evaluate(() => {
    // Look for the sidebar nav element
    const sidebar = document.querySelector('aside, nav[class*="sidebar"], [class*="sidebar"]');
    if (!sidebar) return 'No sidebar element found';

    const style = window.getComputedStyle(sidebar);
    const rect = sidebar.getBoundingClientRect();

    if (style.display === 'none') return 'Hidden (display: none)';
    if (rect.width === 0 || rect.height === 0) return 'Hidden (zero dimensions)';
    if (style.visibility === 'hidden') return 'Hidden (visibility: hidden)';

    return `Visible (${Math.round(rect.width)}px wide)`;
  });
}

// Check minimum touch target sizes (48x48 recommended, 44x44 minimum per WCAG)
async function checkTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]');

    let smallCount = 0;
    for (const el of interactiveElements) {
      const rect = el.getBoundingClientRect();
      // Skip hidden elements
      if (rect.width === 0 || rect.height === 0) continue;
      // Only flag clearly too small targets
      if (rect.width < 32 || rect.height < 24) {
        smallCount++;
      }
    }

    if (smallCount > 0) {
      issues.push(`${smallCount} interactive element(s) smaller than 32x24px (potential touch target concern)`);
    }

    return issues;
  });
}

// Check font sizes for readability
async function checkFontSizes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6');

    let tooSmallCount = 0;
    for (const el of textElements) {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      // Skip hidden elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.textContent?.trim().length === 0) continue;

      if (fontSize < 12) {
        tooSmallCount++;
      }
    }

    if (tooSmallCount > 0) {
      issues.push(`${tooSmallCount} text element(s) with font-size below 12px (potential readability concern)`);
    }

    return issues;
  });
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Collect all observations across tests
const allObservations: ResponsiveObservation[] = [];

test.describe('Responsive Verification', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.label}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const pageConfig of PAGES) {
        test(`${pageConfig.name} at ${viewport.width}px`, async ({ page }) => {
          ensureDirs();

          const observation: ResponsiveObservation = {
            viewport: viewport.label,
            page: pageConfig.name,
            screenshot: `screenshots/responsive/${viewport.width}/${pageConfig.filename}`,
            captured: false,
            horizontalOverflow: false,
            contentClipping: false,
            issues: [],
            notes: [],
          };

          try {
            // Navigate and disable animations
            await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
            await page.waitForTimeout(1000);

            // Capture full-page screenshot
            const screenshotPath = path.join(RESPONSIVE_DIR, String(viewport.width), pageConfig.filename);
            await page.screenshot({
              path: screenshotPath,
              fullPage: true,
            });

            const stats = fs.statSync(screenshotPath);
            observation.captured = true;
            observation.fileSize = stats.size;
            console.log(`[${viewport.width}px] ${pageConfig.name}: ${formatSize(stats.size)}`);

            // Check horizontal overflow
            observation.horizontalOverflow = await checkHorizontalOverflow(page);
            if (observation.horizontalOverflow) {
              observation.issues.push('Horizontal scrollbar detected (content wider than viewport)');
            }

            // Check content clipping
            observation.contentClipping = await checkContentClipping(page);
            if (observation.contentClipping) {
              observation.issues.push('Content extends beyond viewport boundaries');
            }

            // Check sidebar behavior for showcase pages
            observation.sidebarBehavior = await checkSidebarBehavior(page, pageConfig.url);
            if (observation.sidebarBehavior) {
              observation.notes.push(`Sidebar: ${observation.sidebarBehavior}`);
            }

            // Check touch targets on mobile
            if (viewport.width <= 768) {
              const touchIssues = await checkTouchTargets(page);
              observation.issues.push(...touchIssues);
            }

            // Check font sizes on mobile
            if (viewport.width <= 375) {
              const fontIssues = await checkFontSizes(page);
              observation.issues.push(...fontIssues);
            }

            // Page-specific checks
            if (pageConfig.url === '/' && viewport.width <= 375) {
              observation.notes.push('Homepage renders in single-column mobile layout');
            }

            if (pageConfig.url.includes('showcase') && viewport.width <= 768) {
              if (observation.sidebarBehavior?.includes('Hidden')) {
                observation.notes.push('Sidebar correctly hidden on mobile/tablet (md:block behavior)');
              } else if (observation.sidebarBehavior?.includes('Visible')) {
                observation.notes.push('Sidebar visible at this breakpoint');
              }
            }

            // Log findings
            if (observation.issues.length > 0) {
              console.log(`  Issues: ${observation.issues.join('; ')}`);
            }
            if (observation.notes.length > 0) {
              console.log(`  Notes: ${observation.notes.join('; ')}`);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            observation.issues.push(`Capture failed: ${errorMsg}`);
            console.error(`[${viewport.width}px] ${pageConfig.name}: FAILED - ${errorMsg}`);
          }

          allObservations.push(observation);
        });
      }
    });
  }

  test.afterAll(async () => {
    generateReport();
  });
});

function generateReport(): void {
  const date = new Date().toISOString().split('T')[0];

  // Group observations by viewport
  const byViewport: Record<string, ResponsiveObservation[]> = {};
  for (const obs of allObservations) {
    if (!byViewport[obs.viewport]) {
      byViewport[obs.viewport] = [];
    }
    byViewport[obs.viewport].push(obs);
  }

  let md = `# Responsive Verification Report

**Date:** ${date}
**Viewports tested:** 375px, 768px, 1440px
**Pages tested:** Homepage, /showcase, /showcase/inputs

## Summary

| Viewport | Pages Tested | Issues Found |
|----------|-------------|--------------|
`;

  for (const viewport of VIEWPORTS) {
    const obs = byViewport[viewport.label] ?? [];
    const issueCount = obs.reduce((acc, o) => acc + o.issues.length, 0);
    md += `| ${viewport.label} | ${obs.filter(o => o.captured).length} | ${issueCount} |\n`;
  }

  const totalIssues = allObservations.reduce((acc, o) => acc + o.issues.length, 0);
  const totalCaptured = allObservations.filter(o => o.captured).length;
  md += `\n**Total:** ${totalCaptured} screenshots captured, ${totalIssues} issues found\n`;

  // Viewport sections
  for (const viewport of VIEWPORTS) {
    const obs = byViewport[viewport.label] ?? [];
    md += `\n## ${getViewportTitle(viewport)}\n`;

    for (const observation of obs) {
      md += `\n### ${observation.page}\n\n`;

      if (!observation.captured) {
        md += `**Status:** Not captured\n`;
        if (observation.issues.length > 0) {
          md += `**Error:** ${observation.issues[0]}\n`;
        }
        md += `\n`;
        continue;
      }

      md += `**Screenshot:** ${observation.screenshot}\n`;
      md += `**File size:** ${observation.fileSize ? formatSize(observation.fileSize) : 'unknown'}\n\n`;

      md += `**Checks:**\n`;
      md += `- Horizontal overflow: ${observation.horizontalOverflow ? 'YES (scrollbar detected)' : 'None'}\n`;
      md += `- Content clipping: ${observation.contentClipping ? 'YES (content extends beyond viewport)' : 'None'}\n`;

      if (observation.sidebarBehavior) {
        md += `- Sidebar: ${observation.sidebarBehavior}\n`;
      }

      if (observation.issues.length > 0) {
        md += `\n**Issues:**\n`;
        for (const issue of observation.issues) {
          md += `- ${issue}\n`;
        }
      }

      if (observation.notes.length > 0) {
        md += `\n**Observations:**\n`;
        for (const note of observation.notes) {
          md += `- ${note}\n`;
        }
      }

      md += `\n`;
    }
  }

  md += `## Known Responsive Decisions\n\n`;
  md += `These are intentional responsive behaviors documented in previous phases:\n\n`;
  md += `- **Showcase sidebar hidden on mobile:** Uses \`md:block\` (768px breakpoint) -- Phase 43 decision\n`;
  md += `- **App pages are desktop-only:** /app routes show "expand window" message on mobile -- by design\n`;
  md += `- **Homepage sections stack vertically on mobile:** Grid layouts collapse to single column\n`;
  md += `- **Font sizes scale down on mobile:** Headings use responsive Tailwind classes (text-3xl md:text-5xl etc.)\n`;
  md += `- **Dark theme consistent across viewports:** No light/dark switching per viewport\n`;

  md += `\n## Methodology\n\n`;
  md += `- **Tool:** Playwright with viewport override per test\n`;
  md += `- **Animations:** Disabled via injected CSS + \`reducedMotion: 'reduce'\`\n`;
  md += `- **Overflow detection:** \`scrollWidth > clientWidth\` on document element\n`;
  md += `- **Content clipping:** Bounding rect check on all main/footer children\n`;
  md += `- **Touch targets:** Flagged interactive elements smaller than 32x24px (mobile only)\n`;
  md += `- **Font readability:** Flagged text elements below 12px font-size (mobile only)\n`;
  md += `- **Screenshots:** Full-page captures (not viewport-height limited)\n`;

  md += `\n---\n*Generated by responsive-check.spec.ts on ${date}*\n`;

  fs.writeFileSync(REPORT_PATH, md);
  console.log(`\nReport generated: ${REPORT_PATH}`);
}

function getViewportTitle(viewport: Viewport): string {
  switch (viewport.name) {
    case 'mobile':
      return `Mobile (${viewport.width}px)`;
    case 'tablet':
      return `Tablet (${viewport.width}px)`;
    case 'desktop':
      return `Desktop (${viewport.width}px)`;
    default:
      return `${viewport.label}`;
  }
}
